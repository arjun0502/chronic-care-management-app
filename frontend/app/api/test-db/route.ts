import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const userCount = await prisma.user.count();
    const physicianCount = await prisma.user.count({ where: { role: "physician" } });
    const patientCount = await prisma.user.count({ where: { role: "patient" } });
    const relationshipCount = await prisma.physicianPatient.count();
    
    // Get all relationships with details
    const relationships = await prisma.physicianPatient.findMany({
      include: {
        physician: {
          select: { id: true, name: true, email: true },
        },
        patient: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10, // Last 10 relationships
    });
    
    return NextResponse.json({ 
      success: true, 
      message: "Database connected successfully!",
      counts: {
        totalUsers: userCount,
        physicians: physicianCount,
        patients: patientCount,
        relationships: relationshipCount,
      },
      recentRelationships: relationships,
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}