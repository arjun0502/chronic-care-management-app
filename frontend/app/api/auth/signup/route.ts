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
      // Find the default cardiologist
      const cardiologist = await prisma.user.findUnique({
        where: { email: "cardiologist@cardiotrack.com" },
      });

      if (cardiologist) {
        await prisma.physicianPatient.create({
          data: {
            physicianId: cardiologist.id,
            patientId: user.id,
          },
        });
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

    // Create default goals for patients
    if (role === "patient") {
      // Use user's initial weight as weight goal if provided, otherwise null
      const initialWeightGoal = weight ? parseFloat(weight) : null;
      
      await prisma.goal.create({
        data: {
          userId: user.id,
          systolicGoal: 130,
          diastolicGoal: 80,
          weightGoal: initialWeightGoal,
          glucoseGoal: 130,
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
