import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized - physicians only" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

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

    // Get cached analysis
    const analysis = await prisma.patientAnalysis.findUnique({
      where: { userId: patientId },
    });

    if (!analysis) {
      return NextResponse.json({
        success: true,
        data: {
          summary: "Analysis not yet available. Patient may not have chatted yet.",
          urgency: "stable",
          urgencyScore: 0,
          reasons: [],
          keyConcerns: [],
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: analysis.summary,
        urgency: analysis.urgency,
        urgencyScore: analysis.urgencyScore,
        reasons: analysis.reasons,
        keyConcerns: analysis.keyConcerns,
        lastUpdated: analysis.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}

