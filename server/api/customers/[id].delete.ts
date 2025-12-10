import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";
import { unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const id = event.context.params?.id || "";

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "ລະຫັດລູກຄ້າບໍ່ຖືກຕ້ອງ",
    });
  }

  // Get existing customer with sales count
  const existingCustomer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: { sales: true },
      },
    },
  });

  if (!existingCustomer) {
    throw createError({
      statusCode: 404,
      message: "ບໍ່ພົບລູກຄ້າ",
    });
  }

  // Prevent deletion if customer has sales
  if (existingCustomer._count.sales > 0) {
    throw createError({
      statusCode: 400,
      message: "ບໍ່ສາມາດລຶບລູກຄ້າທີ່ມີປະຫວັດການຊື້ໄດ້",
    });
  }

  // Delete customer image if exists
  if (existingCustomer.image) {
    try {
      const imagePath = join(process.cwd(), "public", existingCustomer.image);
      if (existsSync(imagePath)) {
        await unlink(imagePath);
      }
    } catch (err) {
      // Ignore file deletion errors
      console.error("Error deleting customer image:", err);
    }
  }

  // Delete customer
  await prisma.customer.delete({
    where: { id },
  });

  return {
    success: true,
    message: "ລຶບລູກຄ້າສຳເລັດ",
  };
});

