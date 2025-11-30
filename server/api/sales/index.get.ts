import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);

  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const search = query.search as string;
  const status = query.status as string;

  const skip = (page - 1) * limit;

  const where: Parameters<typeof prisma.sale.findMany>[0]["where"] = {};

  // For employees, filter out admin's sales if admin has any sales
  if (user.role === "EMPLOYEE") {
    // Check if admin has any sales
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (adminUser) {
      const adminHasSales = await prisma.sale.count({
        where: { userId: adminUser.id },
      });

      // If admin has sales, exclude admin's sales from employee view
      if (adminHasSales > 0) {
        where.userId = {
          not: adminUser.id,
        };
      }
    }

    // Also limit to today's sales (day by day)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setHours(23, 59, 59, 999);
    
    where.createdAt = {
      gte: startOfToday,
      lte: endOfToday,
    };
  }

  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search } },
      { customer: { firstName: { contains: search } } },
      { customer: { lastName: { contains: search } } },
      { customer: { phone: { contains: search } } },
    ];
  }

  if (status) {
    where.status = status as "PAID" | "UNPAID" | "TRANSFER";
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: true,
        user: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            product: true,
            service: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    success: true,
    data: sales.map((sale) => ({
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
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
});

