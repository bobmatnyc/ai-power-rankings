import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      isAdmin?: boolean;
    } & DefaultSession["user"];
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    isAdmin?: boolean;
  }
}
