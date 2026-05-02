"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type LoginRequest, loginRequestSchema } from "@workspace/shared/api";
import { signIn } from "@/lib/better-auth/auth-client";

/**
 * Hook for sign in with React Query mutation
 * Uses Zod schema from @workspace/shared for validation
 */
export function useSignIn(redirectTo?: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      const validation = loginRequestSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid input");
      }

      const result = await signIn(validation.data);

      if (result.error) {
        throw new Error(result.error.message ?? "Failed to sign in");
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push(redirectTo ?? "/events");
      router.refresh();
    },
  });
}
