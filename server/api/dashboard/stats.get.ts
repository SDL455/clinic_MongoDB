import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);

  const now = new Date();
  
  // Calculate date ranges
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  
  // Start of this week (Sunday)
  const startOfThisWeek = new Date(startOfToday);
  startOfThisWeek.setDate(startOfThisWeek.getDate() - startOfThisWeek.getDay());
  
  // End of this week (Saturday)
  const endOfThisWeek = new Date(startOfThisWeek);
  endOfThisWeek.setDate(endOfThisWeek.getDate() + 6);
  endOfThisWeek.setHours(23, 59, 59, 999);
  
  // Start of this month
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // End of this month
  const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfThisMonth.setHours(23, 59, 59, 999);

  // Build base where clause for filtering admin's sales for employees
  let baseWhere: Parameters<typeof prisma.sale.findMany>[0]["where"] = {};
  let customerWhere: Parameters<typeof prisma.customer.findMany>[0]["where"] = {};

  if (user.role === "EMPLOYEE") {
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (adminUser) {
      const adminHasSales = await prisma.sale.count({
        where: { userId: adminUser.id },
      });

      if (adminHasSales > 0) {
        // Exclude admin's sales
        baseWhere.userId = {
          not: adminUser.id,
        };

        // Exclude customers who have sales from admin
        const adminSaleCustomers = await prisma.sale.findMany({
          where: { userId: adminUser.id },
          select: { customerId: true },
          distinct: ["customerId"],
        });

        const adminCustomerIds = adminSaleCustomers.map((s) => s.customerId);

        if (adminCustomerIds.length > 0) {
          customerWhere.id = {
            notIn: adminCustomerIds,
          };
        }
      }
    }
  }

  // Get all products for low stock check (need to compare stock with minStock)
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { stock: true, minStock: true },
  });

  const lowStockCount = allProducts.filter((p) => p.stock <= p.minStock).length;

  // Get statistics
  const [
    totalSales,
    totalRevenue,
    totalCustomers,
    todayRevenue,
    weekRevenue,
    monthRevenue,
  ] = await Promise.all([
    // Total sales count
    prisma.sale.count({ where: baseWhere }),

    // Total revenue (only PAID and TRANSFER statuses)
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        ...baseWhere,
        status: {
          in: ["PAID", "TRANSFER"],
        },
      },
    }),

    // Total customers
    prisma.customer.count({ where: customerWhere }),

    // Today's revenue - only PAID and TRANSFER statuses
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        ...baseWhere,
        status: {
          in: ["PAID", "TRANSFER"],
        },
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    }),

    // This week's revenue - only PAID and TRANSFER statuses
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        ...baseWhere,
        status: {
          in: ["PAID", "TRANSFER"],
        },
        createdAt: {
          gte: startOfThisWeek,
          lte: endOfThisWeek,
        },
      },
    }),

    // This month's revenue - only PAID and TRANSFER statuses
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        ...baseWhere,
        status: {
          in: ["PAID", "TRANSFER"],
        },
        createdAt: {
          gte: startOfThisMonth,
          lte: endOfThisMonth,
        },
      },
    }),
  ]);

  return {
    success: true,
    data: {
      totalSales,
      totalRevenue: Number(totalRevenue._sum.total || 0),
      totalCustomers,
      lowStockProducts: lowStockCount,
      todayRevenue: Number(todayRevenue._sum.total || 0),
      weekRevenue: Number(weekRevenue._sum.total || 0),
      monthRevenue: Number(monthRevenue._sum.total || 0),
    },
  };
});
