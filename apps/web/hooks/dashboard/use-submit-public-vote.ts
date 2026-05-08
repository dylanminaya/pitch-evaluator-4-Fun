"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreatePublicVote,
  createPublicVoteSchema,
} from "@workspace/shared/api";
import { submitPublicVote } from "@/lib/dashboard-api";

export function useSubmitPublicVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePublicVote) => {
      const validation = createPublicVoteSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid vote data");
      }

      return submitPublicVote(validation.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["public-pitch", variables.pitchId] });
    },
  });
}
