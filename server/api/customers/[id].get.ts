import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);

  const id = event.context.params?.id || "";

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "ລະຫັດລູກຄ້າບໍ່ຖືກຕ້ອງ",
    });
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, role: true } },
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    throw createError({
      statusCode: 404,
      message: "ບໍ່ພົບລູກຄ້າ",
    });
  }

  // For employees, check if customer has sales from admin
  if (user.role === "EMPLOYEE") {
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (adminUser) {
      const adminHasSales = await prisma.sale.count({
        where: { userId: adminUser.id },
      });

      // If admin has sales and this customer has sales from admin, deny access
      if (adminHasSales > 0) {
        const customerHasAdminSales = customer.sales.some(
          (sale) => sale.user.role === "ADMIN"
        );

        if (customerHasAdminSales) {
          throw createError({
            statusCode: 403,
            message: "ທ່ານບໍ່ມີສິດເຂົ້າເຖິງຂໍ້ມູນລູກຄ້ານີ້",
          });
        }
      }
    }

    // Filter out admin's sales from the sales history for employees (in case admin has no sales)
    customer.sales = customer.sales.filter((sale) => sale.user.role !== "ADMIN");
  }

  return {
    success: true,
    data: {
      ...customer,
      sales: customer.sales.map((sale) => ({
        ...sale,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        total: Number(sale.total),
        items: sale.items.map((item) => ({
          ...item,
          price: Number(item.price),
          total: Number(item.total),
        })),
      })),
    },
  };
});

