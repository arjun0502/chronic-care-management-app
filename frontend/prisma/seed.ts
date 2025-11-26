import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Check if dummy cardiologist already exists
  const existingPhysician = await prisma.user.findUnique({
    where: { email: "cardiologist@cardiotrack.com" },
  });

  if (!existingPhysician) {
    // Create dummy cardiologist
    const hashedPassword = await hash("cardiologist123", 10);
    
    const cardiologist = await prisma.user.create({
      data: {
        email: "cardiologist@cardiotrack.com",
        name: "Dr. Sarah Johnson",
        password: hashedPassword,
        role: "physician",
      },
    });

    console.log("✅ Created dummy cardiologist:", cardiologist.email);
  } else {
    console.log("✅ Dummy cardiologist already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

