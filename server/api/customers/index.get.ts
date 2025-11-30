import { prisma } from "../../utils/prisma";
import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event);

  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const search = query.search as string;

  const skip = (page - 1) * limit;

  const where: Parameters<typeof prisma.customer.findMany>[0]["where"] = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  // For employees, exclude customers who have sales from admin (if admin has sales)
  if (user.role === "EMPLOYEE") {
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (adminUser) {
      const adminHasSales = await prisma.sale.count({
        where: { userId: adminUser.id },
      });

      // If admin has sales, exclude customers who have any sales from admin
      if (adminHasSales > 0) {
        // Get customer IDs that have sales from admin
        const adminSaleCustomers = await prisma.sale.findMany({
          where: { userId: adminUser.id },
          select: { customerId: true },
          distinct: ["customerId"],
        });

        const adminCustomerIds = adminSaleCustomers.map((s) => s.customerId);

        if (adminCustomerIds.length > 0) {
          where.id = {
            notIn: adminCustomerIds,
          };
        }
      }
    }
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: { sales: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    success: true,
    data: customers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
});

