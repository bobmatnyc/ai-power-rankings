import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";

export async function POST() {
  try {
    const payload = await getPayload({ config });

    // Check if admin user already exists
    const existingUsers = await payload.find({
      collection: "users",
      where: {
        email: { equals: "admin@aipowerrankings.com" },
      },
      limit: 1,
    });

    if (existingUsers.docs.length > 0) {
      return NextResponse.json({
        message: "Admin user already exists",
        email: "admin@aipowerrankings.com",
      });
    }

    // Create admin user
    const adminUser = await payload.create({
      collection: "users",
      data: {
        email: "admin@aipowerrankings.com",
        name: "Admin User",
        password: "admin123",
        role: "admin",
        authProvider: "local",
      },
    });

    return NextResponse.json({
      message: "Admin user created successfully",
      email: "admin@aipowerrankings.com",
      password: "admin123",
      id: adminUser.id,
    });
  } catch (error) {
    console.error("Error creating admin user:", error);
    return NextResponse.json({ error: "Failed to create admin user" }, { status: 500 });
  }
}
