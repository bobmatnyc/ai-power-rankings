import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAuthorizedEmail } from "@/lib/auth-config";

export const config: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env["GOOGLE_OAUTH_CLIENT_ID"] || "",
      clientSecret: process.env["GOOGLE_OAUTH_CLIENT_SECRET"] || "",
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
    authorized() {
      // Don't interfere with Payload's admin routes - let Payload handle its own auth
      return true;
    },
    async signIn({ user }) {
      // Only allow authorized emails to sign in
      return isAuthorizedEmail(user.email);
    },
    async session({ session, token }) {
      if (isAuthorizedEmail(session.user?.email)) {
        session.user.isAdmin = true;
      }
      // Pass the access token to the session
      session["accessToken"] = token["accessToken"] as string;
      return session;
    },
    async jwt({ token, user, account }) {
      if (isAuthorizedEmail(user?.email)) {
        token["isAdmin"] = true;
      }
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token["accessToken"] = account.access_token;
        token["refreshToken"] = account.refresh_token;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env["NODE_ENV"] === "development",
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);
