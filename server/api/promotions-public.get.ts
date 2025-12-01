import { prisma } from "../utils/prisma";

// Public endpoint for promotions - no authentication required
export default defineEventHandler(async () => {
  try {
    const now = new Date();
    
    // Only return active promotions that are within their date range
    const promotions = await prisma.promotion.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: promotions.map((p) => ({
        ...p,
        discount: Number(p.discount),
      })),
    };
  } catch (error) {
    console.error("Error fetching public promotions:", error);
    return {
      success: false,
      error: "ບໍ່ສາມາດດຶງຂໍ້ມູນໂປຣໂມຊັນໄດ້",
      data: [],
    };
  }
});

