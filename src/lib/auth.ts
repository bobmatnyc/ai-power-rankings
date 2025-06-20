import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Simple hardcoded authentication for bob@matsuoka.com
        if (credentials?.email === "bob@matsuoka.com" && credentials?.password === "admin123") {
          return {
            id: "1",
            email: "bob@matsuoka.com",
            name: "Admin User",
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow bob@matsuoka.com to sign in
      if (user.email === "bob@matsuoka.com") {
        return true;
      }
      return false;
    },
    async session({ session }) {
      // Add admin flag for bob@matsuoka.com
      if (session.user?.email === "bob@matsuoka.com") {
        (session.user as any)["isAdmin"] = true;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user?.email === "bob@matsuoka.com") {
        token["isAdmin"] = true;
      }
      return token;
    },
  },
  pages: {
    signIn: "/admin/auth/signin",
    error: "/admin/auth/error",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
};
