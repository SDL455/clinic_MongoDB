import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";
import { writeFile, mkdir, unlink } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = event.context.params?.id || "";

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "ລະຫັດໂປຣໂມຊັ່ນບໍ່ຖືກຕ້ອງ",
    });
  }

  // Check if promotion exists
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: "ບໍ່ພົບໂປຣໂມຊັ່ນ",
    });
  }

  const formData = await readMultipartFormData(event);

  if (!formData) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາສົ່ງຂໍ້ມູນ",
    });
  }

  // Parse form data
  let name: string | undefined;
  let description: string | undefined;
  let discount: number | undefined;
  let isPercent: boolean | undefined;
  let startDate: string | undefined;
  let endDate: string | undefined;
  let isActive: boolean | undefined;
  let existingImages: string[] = [];
  const imageFiles: { data: Buffer; filename: string }[] = [];

  for (const field of formData) {
    if (field.name === "name" && field.data) {
      name = field.data.toString("utf-8");
    } else if (field.name === "description" && field.data) {
      description = field.data.toString("utf-8");
    } else if (field.name === "discount" && field.data) {
      discount = parseFloat(field.data.toString("utf-8"));
    } else if (field.name === "isPercent" && field.data) {
      isPercent = field.data.toString("utf-8") === "true";
    } else if (field.name === "startDate" && field.data) {
      startDate = field.data.toString("utf-8");
    } else if (field.name === "endDate" && field.data) {
      endDate = field.data.toString("utf-8");
    } else if (field.name === "isActive" && field.data) {
      isActive = field.data.toString("utf-8") === "true";
    } else if (field.name === "existingImages" && field.data) {
      try {
        existingImages = JSON.parse(field.data.toString("utf-8"));
      } catch {
        existingImages = [];
      }
    } else if (field.name === "images" && field.data && field.filename) {
      imageFiles.push({ data: field.data, filename: field.filename });
    }
  }

  // Validate total image count
  if (existingImages.length + imageFiles.length > 10) {
    throw createError({
      statusCode: 400,
      message: "ບໍ່ສາມາດເພີ່ມຮູບພາບເກີນ 10 ຮູບ",
    });
  }

  // Delete removed images from storage
  const oldImages = (existing.images as string[]) || [];
  const imagesToDelete = oldImages.filter((img) => !existingImages.includes(img));

  for (const imgPath of imagesToDelete) {
    try {
      const fullPath = join(process.cwd(), "public", imgPath);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
      }
    } catch (error) {
      console.error("Failed to delete image:", error);
    }
  }

  // Upload new images
  const newImagePaths: string[] = [];
  if (imageFiles.length > 0) {
    const uploadDir = join(process.cwd(), "public", "uploads", "promotions");

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const file of imageFiles) {
      const ext = extname(file.filename);
      const filename = `promotion-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const filePath = join(uploadDir, filename);

      await writeFile(filePath, file.data);
      newImagePaths.push(`/uploads/promotions/${filename}`);
    }
  }

  // Combine existing and new images
  const finalImages = [...existingImages, ...newImagePaths];

  const promotion = await prisma.promotion.update({
    where: { id },
    data: {
      name,
      description,
      discount,
      isPercent,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      isActive,
      images: finalImages.length > 0 ? finalImages : null,
    },
  });

  return {
    success: true,
    data: {
      ...promotion,
      discount: Number(promotion.discount),
      images: finalImages,
    },
    message: "ອັບເດດໂປຣໂມຊັ່ນສຳເລັດ",
  };
});
