import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/** Read the GitHub access token from the encrypted server-side JWT. Never exposed to the client. */
export async function getGithubToken(req: NextRequest): Promise<string | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const token = await getToken({ req, secret, secureCookie: process.env.NODE_ENV === "production" });
    return typeof token?.accessToken === "string" ? token.accessToken : null;
  } catch {
    return null;
  }
}
