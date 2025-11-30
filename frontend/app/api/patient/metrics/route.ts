import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  computeAllMetrics,
  mapGoals,
  mapMeasurements,
} from "@/lib/metrics";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId") || session.user.id;

    // If requesting another patient's metrics, verify user is a physician
    if (patientId !== session.user.id && session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized to view this patient's metrics" },
        { status: 403 }
      );
    }

    // If physician, verify relationship
    if (patientId !== session.user.id) {
      try {
        const relationship = await prisma.physicianPatient.findFirst({
          where: {
            physicianId: session.user.id,
            patientId: patientId,
          },
        });

        if (!relationship) {
          return NextResponse.json(
            { success: false, error: "Patient not found or access denied" },
            { status: 403 }
          );
        }
      } catch (dbError) {
        if (dbError instanceof PrismaClientKnownRequestError && dbError.code === "P1001") {
          console.error("Database connection error while verifying physician access:", dbError);
          return NextResponse.json(
            {
              success: false,
              error: "Database connection failed. Please check your database configuration.",
            },
            { status: 503 }
          );
        }
        throw dbError;
      }
    }

    const userId = patientId;

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
    if (error instanceof PrismaClientKnownRequestError && error.code === "P1001") {
      return NextResponse.json(
        {
          success: false,
          error: "Database connection failed. Please check your database configuration.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to compute patient metrics" },
      { status: 500 }
    );
  }
}


