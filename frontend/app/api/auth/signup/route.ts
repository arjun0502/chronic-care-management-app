import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      role,
      // Patient-specific fields
      dob,
      sex,
      height,
      weight,
      conditions,
      allergies,
      familyHistoryHeartDisease,
      smokingHistory,
      smokingDetails,
      alcoholUse,
      medications,
    } = body;

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user with patient-specific data if role is patient
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || "patient",
        // Patient-specific fields (only set if role is patient)
        ...(role === "patient" && {
          dob: dob || null,
          sex: sex || null,
          height: height ? parseFloat(height) : null,
          weight: weight ? parseFloat(weight) : null,
          conditions: conditions || [],
          allergies: allergies || [],
          familyHistoryHeartDisease: familyHistoryHeartDisease || null,
          smokingHistory: smokingHistory || null,
          smokingDetails: smokingDetails || null,
          alcoholUse: alcoholUse || null,
        }),
      },
    });

    // Link patient to default cardiologist
    if (role === "patient") {
      // Use hardcoded cardiologist ID
      const cardiologistId = "cmifij1pi0000lw9w2l0wdo4m";
      
      try {
        // Use upsert to handle case where relationship might already exist
        await prisma.physicianPatient.upsert({
          where: {
            physicianId_patientId: {
              physicianId: cardiologistId,
              patientId: user.id,
            },
          },
          update: {}, // No update needed if it exists
          create: {
            physicianId: cardiologistId,
            patientId: user.id,
          },
        });
        console.log(`✅ Linked patient ${user.id} (${user.email}) to cardiologist ${cardiologistId}`);
      } catch (error) {
        console.error("Error creating physician-patient relationship:", error);
        // Don't fail the signup if this fails, but log it
      }
    }

    // Create medications if provided
    if (role === "patient" && medications && medications.length > 0) {
      await prisma.medication.createMany({
        data: medications.map((med: { name: string; dosage: string; frequency: string }) => ({
          userId: user.id,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
        })),
      });
    }

    // Create default goals for patients (range-based)
    if (role === "patient") {
      // Use user's initial weight as baseline if provided
      const initialWeightBaseline = weight ? parseFloat(weight) : null;
      
      await prisma.goal.create({
        data: {
          userId: user.id,
          // BP ranges: SBP 110-135, DBP 70-85
          systolicMin: 110,
          systolicMax: 135,
          diastolicMin: 70,
          diastolicMax: 85,
          // Glucose range: 70-180
          glucoseMin: 70,
          glucoseMax: 180,
          // Weight: baseline and alert thresholds
          weightBaseline: initialWeightBaseline,
          weightDailyAlertThreshold: 2.0, // Alert if daily gain > 2 lbs
          weightWeeklyAlertThreshold: 5.0, // Alert if weekly gain > 5 lbs
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      userId: user.id,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
