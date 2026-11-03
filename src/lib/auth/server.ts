import { createNeonAuth } from "@neon/auth/next/server";

/** Neon Auth (hosted Better Auth). Secrets come from Vercel env vars; see `vercel env pull`. */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
