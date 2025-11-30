import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
    const {
      patientId,
      date,
      title,
      description,
      lifestyleChanges,
      medicationChanges,
    } = body;

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
      try {
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

    const eventDate = new Date(date);
    eventDate.setHours(0, 0, 0, 0);

    const event = await prisma.event.create({
      data: {
        userId,
        date: eventDate,
        title,
        description: description || null,
        lifestyleChanges: Array.isArray(lifestyleChanges)
          ? lifestyleChanges.map((v: unknown) => String(v))
          : [],
        medicationChanges: Array.isArray(medicationChanges)
          ? medicationChanges.map((v: unknown) => String(v))
          : [],
      },
    });

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error("Error creating event:", error);
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
      { success: false, error: "Failed to create event" },
      { status: 500 }
    );
  }
}

