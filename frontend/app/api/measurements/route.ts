import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to calculate average
function calculateAverage(values: (string | number)[]): number {
  const numericValues = values
    .map(v => typeof v === "string" ? parseFloat(v) : v)
    .filter(v => !isNaN(v) && v > 0);
  
  if (numericValues.length === 0) return 0;
  return numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bloodPressure, glucose, cholesterol, dateTime, userId } = body;

    // Validate userId (you'll get this from session/auth later)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 401 }
      );
    }

    // Calculate averages
    const avgSystolic = calculateAverage(
      bloodPressure.map((bp: { systolic: string }) => bp.systolic).filter((v: string) => v)
    );
    const avgDiastolic = calculateAverage(
      bloodPressure.map((bp: { diastolic: string }) => bp.diastolic).filter((v: string) => v)
    );
    const avgGlucose = calculateAverage(glucose.filter((g: string) => g));
    const avgCholesterol = calculateAverage(cholesterol.filter((c: string) => c));

    // Filter out empty measurements for raw data
    const bpRaw = bloodPressure.filter(
      (bp: { systolic: string; diastolic: string }) => bp.systolic && bp.diastolic
    );
    const glucoseRaw = glucose.filter((g: string) => g);
    const cholesterolRaw = cholesterol.filter((c: string) => c);

    // Save to database
    const measurement = await prisma.measurement.create({
      data: {
        userId,
        date: new Date(dateTime),
        systolic: avgSystolic > 0 ? Math.round(avgSystolic * 10) / 10 : null,
        diastolic: avgDiastolic > 0 ? Math.round(avgDiastolic * 10) / 10 : null,
        bpRaw: bpRaw.length > 0 ? bpRaw : null,
        glucose: avgGlucose > 0 ? Math.round(avgGlucose * 10) / 10 : null,
        glucoseRaw: glucoseRaw.length > 0 ? glucoseRaw : null,
        cholesterol: avgCholesterol > 0 ? Math.round(avgCholesterol * 10) / 10 : null,
        cholesterolRaw: cholesterolRaw.length > 0 ? cholesterolRaw : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: measurement,
      message: "Measurements saved and averaged successfully",
    });
  } catch (error) {
    console.error("Error processing measurements:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process measurements" },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve measurements for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID required" },
        { status: 401 }
      );
    }

    const measurements = await prisma.measurement.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 100,
    });

    return NextResponse.json({
      success: true,
      data: measurements,
    });
  } catch (error) {
    console.error("Error fetching measurements:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch measurements" },
      { status: 500 }
    );
  }
}