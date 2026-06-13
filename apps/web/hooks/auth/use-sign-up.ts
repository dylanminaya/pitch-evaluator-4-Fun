"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  type RegisterRequest,
  registerRequestSchema,
} from "@workspace/shared/api";
import { signUp } from "@/lib/better-auth/auth-client";

/**
 * Hook for sign up with React Query mutation
 * Uses Zod schema from @workspace/shared for validation
 */
export function useSignUp(redirectTo?: string) {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: RegisterRequest) => {
      const validation = registerRequestSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid input");
      }

      const result = await signUp(validation.data);

      if (result.error) {
        throw new Error(result.error.message ?? "Failed to create account");
      }

      return result.data;
    },
    onSuccess: () => {
      router.push(redirectTo ?? "/events");
    },
  });
}
