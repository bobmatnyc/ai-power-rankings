import type { PayloadRequest } from "payload";
import { auth } from "@/auth";

export const autoLoginHook = async (req: PayloadRequest) => {
  try {
    // Get NextAuth session
    const session = await auth();

    if (session?.user?.email === "bob@matsuoka.com") {
      // Find or create user in Payload
      const users = await req.payload.find({
        collection: "users",
        where: {
          email: { equals: session.user.email },
        },
        limit: 1,
      });

      let user = users.docs[0];

      if (!user) {
        // Create user if doesn't exist
        user = await req.payload.create({
          collection: "users",
          data: {
            email: session.user.email,
            name: session.user.name || session.user.email,
            password: "nextauth-user-" + Math.random(), // Random password since we don't use it
            role: "admin",
            auth_provider: "oauth",
          },
        });
      }

      // Set user on request
      req.user = user as any;
    }
  } catch (error) {
    console.error("Auto-login hook error:", error);
  }
};
