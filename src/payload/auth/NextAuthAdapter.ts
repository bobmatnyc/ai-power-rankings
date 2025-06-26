import type { Payload } from "payload";
import { auth } from "@/auth";

export class NextAuthAdapter {
  private payload: Payload;

  constructor(payload: Payload) {
    this.payload = payload;
  }

  async authenticateFromSession() {
    try {
      // Get NextAuth session
      const session = await auth();

      if (!session?.user?.email) {
        return null;
      }

      // Only allow specific user(s)
      if (session.user.email !== "bob@matsuoka.com") {
        return null;
      }

      // Find or create user in Payload
      const { docs: existingUsers } = await this.payload.find({
        collection: "users",
        where: {
          email: { equals: session.user.email },
        },
        limit: 1,
      });

      let user = existingUsers[0];

      if (!user) {
        // Create user in Payload database
        user = await this.payload.create({
          collection: "users",
          data: {
            email: session.user.email,
            name: session.user.name || session.user.email,
            password: `oauth-${Math.random().toString(36).slice(2)}`, // Random password
            role: "admin",
            auth_provider: "oauth",
          },
        });
      }

      return {
        ...user,
        collection: "users",
        _strategy: "nextauth-oauth",
      };
    } catch (error) {
      console.error("NextAuth adapter error:", error);
      return null;
    }
  }

  // Create a JWT token that Payload can use
  async createToken(user: any) {
    const token = await this.payload.login({
      collection: "users",
      data: {
        email: user.email,
        password: user.password,
      },
    });
    return token;
  }
}
