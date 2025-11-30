import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);

  const id = parseInt(event.context.params?.id || "");

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "ລະຫັດການຂາຍບໍ່ຖືກຕ້ອງ",
    });
  }

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      user: { select: { id: true, name: true, role: true } },
      promotion: true,
      items: {
        include: {
          product: { include: { category: true } },
          service: true,
        },
      },
    },
  });

  if (!sale) {
    throw createError({
      statusCode: 404,
      message: "ບໍ່ພົບການຂາຍ",
    });
  }

  // If employee is trying to access admin's sale, deny access
  if (user.role === "EMPLOYEE" && sale.user.role === "ADMIN") {
    // Check if admin has any sales
    const adminHasSales = await prisma.sale.count({
      where: { userId: sale.user.id },
    });

    if (adminHasSales > 0) {
      throw createError({
        statusCode: 403,
        message: "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງການຂາຍນີ້",
      });
    }
  }

  return {
    success: true,
    data: {
      ...sale,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      items: sale.items.map((item) => ({
        ...item,
        price: Number(item.price),
        total: Number(item.total),
      })),
    },
  };
});

