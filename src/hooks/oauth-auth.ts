import { auth } from "@/auth";

export const oauthAuthHook = async (args: any) => {
  const { req } = args;

  // Get the NextAuth session
  const session = await auth();

  if (session?.user?.email) {
    try {
      // Find or create the user in Payload
      const existingUser = await req.payload.find({
        collection: "users",
        where: {
          email: {
            equals: session.user.email,
          },
        },
        limit: 1,
      });

      let user = existingUser.docs[0];

      if (!user) {
        // Create new user if they don't exist
        const userData = {
          email: session.user.email,
          name: session.user.name || session.user.email,
          password: "oauth-user", // Placeholder password for OAuth users
          role: session.user.email === "bob@matsuoka.com" ? "admin" : "viewer",
        };

        const newUser = await req.payload.create({
          collection: "users",
          data: userData,
        });
        user = newUser;
      }

      // Set the user on the request for Payload to use
      req.user = user;
    } catch (error) {
      console.error("OAuth auth hook error:", error);
    }
  }

  return req;
};
