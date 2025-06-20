import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

export const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env["GOOGLE_OAUTH_CLIENT_ID"]!,
      clientSecret: process.env["GOOGLE_OAUTH_CLIENT_SECRET"]!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isAuthPage = nextUrl.pathname.includes("/admin/auth");

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin", nextUrl));
        }
        return true;
      }

      if (isOnAdmin) {
        if (isLoggedIn && auth.user?.email === "bob@matsuoka.com") {
          return true;
        }
        return false; // Redirect unauthenticated users to login page
      }

      return true;
    },
    async signIn({ user }) {
      // Only allow specific email to sign in
      if (user.email === "bob@matsuoka.com") {
        return true;
      }
      return false;
    },
    async session({ session }) {
      if (session.user?.email === "bob@matsuoka.com") {
        session.user.isAdmin = true;
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

export const { handlers, signIn, signOut, auth } = NextAuth(config);
