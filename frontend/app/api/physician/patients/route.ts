import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

// GET: Fetch all patients for the logged-in physician
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - physicians only" },
        { status: 401 }
      );
    }

    const physicianId = session.user.id;

    // Fetch all patients linked to this physician
    const relationships = await prisma.physicianPatient.findMany({
      where: { physicianId },
      include: {
        patient: {
          include: {
            patientAnalysis: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Transform to patient card format
    const patients = await Promise.all(
      relationships.map(async (rel) => {
        const patient = rel.patient;
        
        // Calculate age from DOB
        let age: number | null = null;
        if (patient.dob) {
          const birthDate = new Date(patient.dob);
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }

        // Get analysis or default values
        const analysis = patient.patientAnalysis;
        const urgency = (analysis?.urgency as "urgent" | "monitor" | "stable") || "stable";
        const summary = analysis?.summary || "No analysis available yet.";

        return {
          id: patient.id,
          name: patient.name,
          age,
          conditions: patient.conditions || [],
          urgency,
          summary,
        };
      })
    );

    // Sort by urgency: urgent -> monitor -> stable
    const urgencyOrder = { urgent: 0, monitor: 1, stable: 2 };
    patients.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return NextResponse.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    console.error("Error fetching physician patients:", error);
    
    // Handle database connection errors
    if (error instanceof PrismaClientKnownRequestError && error.code === "P1001") {
      return NextResponse.json(
        { 
          success: false, 
          error: "Database connection failed. Please check your database configuration." 
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

