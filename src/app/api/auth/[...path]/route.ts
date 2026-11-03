import { auth } from "@/lib/auth/server";

// Proxies the auth client's calls to Neon Auth and manages the session cookies.
export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
