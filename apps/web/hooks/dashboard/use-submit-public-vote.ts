"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type CreatePublicVote,
  createPublicVoteSchema,
} from "@workspace/shared/api";
import { submitPublicVote } from "@/lib/dashboard-api";

export function useSubmitPublicVote() {
  return useMutation({
    mutationFn: async (data: CreatePublicVote) => {
      const validation = createPublicVoteSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid vote data");
      }

      return submitPublicVote(validation.data);
    },
  });
}
