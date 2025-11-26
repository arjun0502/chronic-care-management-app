import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";

// GET: Fetch events for a patient
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

    // If requesting another patient's events, verify user is a physician
    if (patientId !== session.user.id && session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized to view this patient's events" },
        { status: 403 }
      );
    }

    const events = await prisma.event.findMany({
      where: { userId: patientId },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}

// POST: Create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { patientId, date, title, description, type } = body;

    const userId = patientId || session.user.id;

    // Verify access (physicians can create for their patients, patients for themselves)
    if (userId !== session.user.id && session.user.role !== "physician") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    // If physician, verify relationship
    if (userId !== session.user.id) {
      const relationship = await prisma.physicianPatient.findFirst({
        where: {
          physicianId: session.user.id,
          patientId: userId,
        },
      });

      if (!relationship) {
        return NextResponse.json(
          { success: false, error: "Patient not found or access denied" },
          { status: 403 }
        );
      }
    }

    const event = await prisma.event.create({
      data: {
        userId,
        date: new Date(date),
        title,
        description: description || null,
        type: type || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create event" },
      { status: 500 }
    );
  }
}

