import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";

// GET: Fetch goals for a patient
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

    // If requesting another patient's goals, verify user is a physician
    if (patientId !== session.user.id && session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized to view this patient's goals" },
        { status: 403 }
      );
    }

    const goals = await prisma.goal.findUnique({
      where: { userId: patientId },
    });

    return NextResponse.json({
      success: true,
      data: goals,
    });
  } catch (error) {
    console.error("Error fetching goals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch goals" },
      { status: 500 }
    );
  }
}

// POST/PUT: Set or update goals for a patient (physician only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - physicians only" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      patientId,
      systolicGoal,
      diastolicGoal,
      weightGoal,
      glucoseGoal,
      cholesterolGoal,
    } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "patientId is required" },
        { status: 400 }
      );
    }

    // Verify physician has access to this patient
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

    // Upsert goals
    const goals = await prisma.goal.upsert({
      where: { userId: patientId },
      update: {
        systolicGoal: systolicGoal !== undefined ? systolicGoal : null,
        diastolicGoal: diastolicGoal !== undefined ? diastolicGoal : null,
        weightGoal: weightGoal !== undefined ? weightGoal : null,
        glucoseGoal: glucoseGoal !== undefined ? glucoseGoal : null,
        cholesterolGoal: cholesterolGoal !== undefined ? cholesterolGoal : null,
        createdBy: session.user.id,
      },
      create: {
        userId: patientId,
        systolicGoal: systolicGoal !== undefined ? systolicGoal : null,
        diastolicGoal: diastolicGoal !== undefined ? diastolicGoal : null,
        weightGoal: weightGoal !== undefined ? weightGoal : null,
        glucoseGoal: glucoseGoal !== undefined ? glucoseGoal : null,
        cholesterolGoal: cholesterolGoal !== undefined ? cholesterolGoal : null,
        createdBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      data: goals,
    });
  } catch (error) {
    console.error("Error setting goals:", error);
    return NextResponse.json(
      { success: false, error: "Failed to set goals" },
      { status: 500 }
    );
  }
}

