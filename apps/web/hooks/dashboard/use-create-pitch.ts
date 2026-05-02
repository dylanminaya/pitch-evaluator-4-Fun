"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateDashboardPitch,
  createDashboardPitchSchema,
} from "@workspace/shared/api";
import { createPitch } from "@/lib/dashboard-api";

export function useCreatePitch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDashboardPitch) => {
      const validation = createDashboardPitchSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid pitch data");
      }

      return createPitch(validation.data);
    },
    onSuccess: (_createdPitch, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pitches", variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ["ranking", variables.eventId] });
    },
  });
}
