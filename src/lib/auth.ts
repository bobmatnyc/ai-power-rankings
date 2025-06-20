import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// Admin user roles
export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin",
  EDITOR: "editor",
  VIEWER: "viewer",
} as const;

export type AdminRole = (typeof ADMIN_ROLES)[keyof typeof ADMIN_ROLES];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env["GITHUB_CLIENT_ID"] || "",
      clientSecret: process.env["GITHUB_CLIENT_SECRET"] || "",
    }),
    Google({
      clientId: process.env["GOOGLE_CLIENT_ID"] || "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] || "",
    }),
  ],
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      // For now, allow any user during development
      // In production, check admin_users table
      return true;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        // Set default role during development
        (token as any).role = "super_admin";
        (token as any).userId = user.email;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).role = (token as any).role;
        (session.user as any).id = (token as any).userId;
      }
      return session;
    },
  },
});