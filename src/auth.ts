import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/** True only when the GitHub OAuth app credentials are configured. */
export const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  // Persist users/accounts to Neon so the cohort has stable identities, but keep
  // JWT sessions so the GitHub access token stays on the encrypted server-side token.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // Minimum read-only scope needed to list repos and read metadata.
      // No write scopes are ever requested. (Private repos need `repo` — see README.)
      authorization: { params: { scope: "read:user" } },
    }),
  ],
  callbacks: {
    // Keep the GitHub access token and the DB user id on the encrypted JWT only.
    async jwt({ token, account, user }) {
      if (account?.access_token) token.accessToken = account.access_token;
      if (user?.id) token.sub = user.id;
      return token;
    },
    // Expose the user id (for ownership checks) but never the access token.
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
