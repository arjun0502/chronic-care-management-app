import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
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
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const { bloodPressure, glucose, weight, dateTime } = body;

    // Calculate averages
    const avgSystolic = calculateAverage(
      bloodPressure.map((bp: { systolic: string }) => bp.systolic).filter((v: string) => v)
    );
    const avgDiastolic = calculateAverage(
      bloodPressure.map((bp: { diastolic: string }) => bp.diastolic).filter((v: string) => v)
    );
    // Glucose is now a single value, not an array
    const avgGlucose = glucose && glucose.trim() !== "" ? parseFloat(glucose) : 0;

    // Filter out empty measurements for raw data
    const bpRaw = bloodPressure.filter(
      (bp: { systolic: string; diastolic: string }) => bp.systolic && bp.diastolic
    );
    // Glucose is now a single value, store it as an array with one element for consistency
    const glucoseRaw = glucose && glucose.trim() !== "" ? [parseFloat(glucose)] : null;

    // Save to database
    const measurement = await prisma.measurement.create({
      data: {
        userId,
        date: new Date(dateTime),
        systolic: avgSystolic > 0 ? Math.round(avgSystolic * 10) / 10 : null,
        diastolic: avgDiastolic > 0 ? Math.round(avgDiastolic * 10) / 10 : null,
        bpRaw: bpRaw.length > 0 ? bpRaw : null,
        glucose: avgGlucose > 0 ? Math.round(avgGlucose * 10) / 10 : null,
        glucoseRaw: glucoseRaw && glucoseRaw.length > 0 ? glucoseRaw : undefined,
        weight: weight ? parseFloat(weight) : null,
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
export async function GET() {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

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