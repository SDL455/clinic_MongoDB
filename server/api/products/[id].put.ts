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
      message: "ລະຫັດສິນຄ້າບໍ່ຖືກຕ້ອງ",
    });
  }

  // Check if product exists
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: "ບໍ່ພົບສິນຄ້າ",
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
  let price: number | undefined;
  let costPrice: number | undefined;
  let stock: number | undefined;
  let minStock: number | undefined;
  let categoryId: string | undefined;
  let existingImages: string[] = [];
  const imageFiles: { data: Buffer; filename: string }[] = [];

  for (const field of formData) {
    if (field.name === "name" && field.data) {
      name = field.data.toString("utf-8");
    } else if (field.name === "description" && field.data) {
      description = field.data.toString("utf-8");
    } else if (field.name === "price" && field.data) {
      price = parseFloat(field.data.toString("utf-8"));
    } else if (field.name === "costPrice" && field.data) {
      costPrice = parseFloat(field.data.toString("utf-8"));
    } else if (field.name === "stock" && field.data) {
      stock = parseInt(field.data.toString("utf-8"), 10);
    } else if (field.name === "minStock" && field.data) {
      minStock = parseInt(field.data.toString("utf-8"), 10);
    } else if (field.name === "categoryId" && field.data) {
      categoryId = field.data.toString("utf-8");
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

  // Validate required fields
  if (name !== undefined && (!name || !name.trim())) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາປ້ອນຊື່ສິນຄ້າ",
    });
  }

  if (price !== undefined && (!price || price <= 0)) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາປ້ອນລາຄາທີ່ຖືກຕ້ອງ",
    });
  }

  if (categoryId !== undefined && !categoryId) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາເລືອກປະເພດ",
    });
  }

  // Validate image count
  const totalImages = existingImages.length + imageFiles.length;
  if (totalImages > 10) {
    throw createError({
      statusCode: 400,
      message: "ບໍ່ສາມາດເພີ່ມຮູບພາບເກີນ 10 ຮູບ",
    });
  }

  // Get old images to delete
  const oldImages = (existing.images as string[]) || [];
  const imagesToDelete = oldImages.filter((img) => !existingImages.includes(img));

  // Delete removed images
  for (const imagePath of imagesToDelete) {
    try {
      const fullPath = join(process.cwd(), "public", imagePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
      }
    } catch (err) {
      // Ignore deletion errors
    }
  }

  // Upload new images
  const newImagePaths: string[] = [];
  if (imageFiles.length > 0) {
    const uploadDir = join(process.cwd(), "public", "uploads", "products");
    
    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    for (const file of imageFiles) {
      const ext = extname(file.filename);
      const filename = `product-${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
      const filePath = join(uploadDir, filename);

      await writeFile(filePath, file.data);
      newImagePaths.push(`/uploads/products/${filename}`);
    }
  }

  // Combine existing and new images
  const allImages = [...existingImages, ...newImagePaths];

  // Update product
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name?.trim() ?? existing.name,
      description: description?.trim() ?? existing.description,
      price: price ?? existing.price,
      costPrice: costPrice ?? existing.costPrice,
      stock: stock ?? existing.stock,
      minStock: minStock ?? existing.minStock,
      categoryId: categoryId ?? existing.categoryId,
      images: allImages.length > 0 ? allImages : null,
      isActive: existing.isActive,
    },
    include: { category: true },
  });

  return {
    success: true,
    data: {
      ...product,
      price: Number(product.price),
      costPrice: Number(product.costPrice),
      images: allImages,
    },
    message: "ອັບເດດສິນຄ້າສຳເລັດ",
  };
});

