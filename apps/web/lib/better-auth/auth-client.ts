"use client";

import { createAuthClient } from "better-auth/react";
import { validateClientEnv } from "@workspace/shared/env/client";

const env = validateClientEnv();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client: any = createAuthClient({
  baseURL: env.NEXT_PUBLIC_API_URL,
  fetchOptions: {
    credentials: "include",
  },
});

/**
 * Sign in with email and password
 */
export function signIn(
  ...args: Parameters<typeof client.signIn.email>
): ReturnType<typeof client.signIn.email> {
  return client.signIn.email(...args);
}

/**
 * Sign up with email and password
 */
export function signUp(
  ...args: Parameters<typeof client.signUp.email>
): ReturnType<typeof client.signUp.email> {
  return client.signUp.email(...args);
}

/**
 * Sign out the current user
 */
export function signOut(): ReturnType<typeof client.signOut> {
  return client.signOut();
}

/**
 * React hook to get the current session
 */
export function useSession(): {
  data: { session: unknown; user: unknown } | null;
  isPending: boolean;
  error: Error | null;
} {
  return client.useSession() as {
    data: { session: unknown; user: unknown } | null;
    isPending: boolean;
    error: Error | null;
  };
}

/**
 * Get the current session (for server components or non-React contexts)
 */
export async function getSession(): Promise<{
  session: unknown;
  user: unknown;
} | null> {
  const result = await client.getSession();
  return result.data;
}
