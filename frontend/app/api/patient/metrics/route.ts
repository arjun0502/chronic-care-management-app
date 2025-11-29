import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  computeAllMetrics,
  mapGoals,
  mapMeasurements,
} from "@/lib/metrics";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    const [goalsRecord, measurementRecords] = await Promise.all([
      prisma.goal.findUnique({ where: { userId } }),
      prisma.measurement.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 60, // recent window for metrics
      }),
    ]);

    if (!measurementRecords || measurementRecords.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          bp: {
            percentInRange14d: 0,
            avgSys3d: 0,
            avgDia3d: 0,
          },
          glucose: {
            percentInRange14d: 0,
            avgGlucose3d: 0,
          },
          weight: {
            change7d: null,
            weeklyAlert: false,
          },
        },
      });
    }

    const goals = mapGoals(goalsRecord);
    const measurements = mapMeasurements(measurementRecords);

    const metrics = computeAllMetrics(measurements, goals);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error computing patient metrics:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute patient metrics" },
      { status: 500 }
    );
  }
}


