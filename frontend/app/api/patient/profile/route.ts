import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { Medication } from "@prisma/client";

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
        goals: user.goals ? {
          systolicGoal: user.goals.systolicGoal,
          diastolicGoal: user.goals.diastolicGoal,
          weightGoal: user.goals.weightGoal,
          glucoseGoal: user.goals.glucoseGoal,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error fetching patient profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patient profile" },
      { status: 500 }
    );
  }
}

