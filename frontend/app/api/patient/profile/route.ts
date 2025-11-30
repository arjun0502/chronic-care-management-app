import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { Medication } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

// Type-safe helper to map goals with all properties
function mapGoals(goals: unknown) {
  if (!goals || typeof goals !== 'object') return null;
  
  const g = goals as Record<string, unknown>;
  
  return {
    systolicMin: (g.systolicMin as number | null) ?? null,
    systolicMax: (g.systolicMax as number | null) ?? null,
    diastolicMin: (g.diastolicMin as number | null) ?? null,
    diastolicMax: (g.diastolicMax as number | null) ?? null,
    glucoseMin: (g.glucoseMin as number | null) ?? null,
    glucoseMax: (g.glucoseMax as number | null) ?? null,
    weightBaseline: (g.weightBaseline as number | null) ?? null,
    weightDailyAlertThreshold: (g.weightDailyAlertThreshold as number | null) ?? null,
    weightWeeklyAlertThreshold: (g.weightWeeklyAlertThreshold as number | null) ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId") || session.user.id;

    // If requesting another patient's profile, verify user is a physician
    if (patientId !== session.user.id && session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized to view this patient's profile" },
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

    // Fetch user with medications, physician, and goals
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        medications: {
          orderBy: { createdAt: "desc" },
        },
        physicians: {
          include: {
            physician: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        goals: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Calculate age from date of birth if available
    let age: number | null = null;
    if (user.dob) {
      const birthDate = new Date(user.dob);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Get primary physician (first one)
    const primaryPhysician = user.physicians.length > 0 ? user.physicians[0].physician : null;

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        dob: user.dob,
        age,
        sex: user.sex,
        height: user.height,
        weight: user.weight,
        conditions: user.conditions || [],
        allergies: user.allergies || [],
        familyHistoryHeartDisease: user.familyHistoryHeartDisease,
        smokingHistory: user.smokingHistory,
        smokingDetails: user.smokingDetails,
        alcoholUse: user.alcoholUse,
        medications: user.medications.map((med: Medication) => ({
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
        })),
        physician: primaryPhysician ? {
          id: primaryPhysician.id,
          name: primaryPhysician.name,
          email: primaryPhysician.email,
        } : null,
        goals: mapGoals(user.goals),
      },
    });
  } catch (error) {
    console.error("Error fetching patient profile:", error);
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
      { success: false, error: "Failed to fetch patient profile" },
      { status: 500 }
    );
  }
}

