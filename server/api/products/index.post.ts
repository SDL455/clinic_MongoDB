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
  let price: number | undefined;
  let costPrice: number | undefined;
  let stock: number | undefined;
  let minStock: number | undefined;
  let categoryId: number | undefined;
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
      categoryId = parseInt(field.data.toString("utf-8"), 10);
    } else if (field.name === "images" && field.data && field.filename) {
      imageFiles.push({ data: field.data, filename: field.filename });
    }
  }

  // Validate required fields
  if (!name || !name.trim()) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາປ້ອນຊື່ສິນຄ້າ",
    });
  }

  if (!price || price <= 0) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາປ້ອນລາຄາທີ່ຖືກຕ້ອງ",
    });
  }

  if (!categoryId || categoryId === 0) {
    throw createError({
      statusCode: 400,
      message: "ກະລຸນາເລືອກປະເພດ",
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
      imagePaths.push(`/uploads/products/${filename}`);
    }
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      price: price,
      costPrice: costPrice || price,
      stock: stock || 0,
      minStock: minStock || 5,
      categoryId: categoryId,
      images: imagePaths.length > 0 ? imagePaths : null,
    },
    include: { category: true },
  });

  return {
    success: true,
    data: {
      ...product,
      price: Number(product.price),
      costPrice: Number(product.costPrice),
      images: imagePaths,
    },
    message: "ເພີ່ມສິນຄ້າສຳເລັດ",
  };
});

