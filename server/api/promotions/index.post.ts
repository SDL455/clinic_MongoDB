import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";
import { writeFile, mkdir } from "fs/promises";
import { join, extname } from "path";
import { existsSync } from "fs";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

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
  let isPercent: boolean = false;
  let startDate: string | undefined;
  let endDate: string | undefined;
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
    } else if (field.name === "images" && field.data && field.filename) {
      imageFiles.push({ data: field.data, filename: field.filename });
    }
  }

  // Validate required fields
  if (!name || !discount || !startDate || !endDate) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາປ້ອນຂໍ້ມູນທີ່ຈຳເປັນ",
    });
  }

  // Validate image count
  if (imageFiles.length > 10) {
    throw createError({
      statusCode: 400,
      message: "ບໍ່ສາມາດເພີ່ມຮູບພາບເກີນ 10 ຮູບ",
    });
  }

  // Upload images
  const imagePaths: string[] = [];
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
      imagePaths.push(`/uploads/promotions/${filename}`);
    }
  }

  const promotion = await prisma.promotion.create({
    data: {
      name,
      description: description || null,
      discount,
      isPercent,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      images: imagePaths.length > 0 ? imagePaths : null,
    },
  });

  return {
    success: true,
    data: {
      ...promotion,
      discount: Number(promotion.discount),
      images: imagePaths,
    },
    message: "ເພີ່ມໂປຣໂມຊັ່ນສຳເລັດ",
  };
});
