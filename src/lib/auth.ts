import { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";

export const authOptions: NextAuthOptions = {
  providers: [
    EmailProvider({
      server: {
        host: process.env["EMAIL_SERVER_HOST"],
        port: process.env["EMAIL_SERVER_PORT"],
        auth: {
          user: process.env["EMAIL_SERVER_USER"],
          pass: process.env["EMAIL_SERVER_PASSWORD"],
        },
      },
      from: process.env["EMAIL_FROM"],
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
};
