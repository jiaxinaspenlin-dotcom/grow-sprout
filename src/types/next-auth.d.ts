import "next-auth/jwt";
import "next-auth";

declare module "next-auth/jwt" {
  interface JWT {
    /** GitHub OAuth access token — server-side only, never sent to the client. */
    accessToken?: string;
  }
}

declare module "next-auth" {
  interface Session {
    user: {
      /** Persisted database user id — used for cohort ownership checks. */
      id: string;
    } & import("next-auth").DefaultSession["user"];
  }
}
