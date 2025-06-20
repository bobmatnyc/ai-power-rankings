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
          scope: "openid email profile https://www.googleapis.com/auth/webmasters.readonly",
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
    async session({ session, token }) {
      if (session.user?.email === "bob@matsuoka.com") {
        session.user.isAdmin = true;
      }
      // Pass the access token to the session
      session.accessToken = token.accessToken as string;
      return session;
    },
    async jwt({ token, user, account }) {
      if (user?.email === "bob@matsuoka.com") {
        token["isAdmin"] = true;
      }
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
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
