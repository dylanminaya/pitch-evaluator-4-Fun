"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type UpdateDashboardPitch,
  updateDashboardPitchSchema,
} from "@workspace/shared/api";
import { updatePitch } from "@/lib/dashboard-api";

export function useUpdatePitch() {
  // React Query cache client to refresh stale dashboard data after updating a pitch.
  const queryClient = useQueryClient();

  return useMutation({
    // Receives the pitch id plus the form payload, validates it, and sends the PATCH request.
    mutationFn: async ({
      pitchId,
      data,
    }: {
      pitchId: string;
      data: UpdateDashboardPitch;
    }) => {
      // Frontend validation keeps obvious bad payloads from reaching the backend.
      const validation = updateDashboardPitchSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid pitch data");
      }

      return updatePitch(pitchId, validation.data);
    },
    // Refresh related queries so dashboard and edit views show the updated pitch immediately.
    onSuccess: (updatedPitch) => {
      queryClient.invalidateQueries({ queryKey: ["pitches", updatedPitch.eventId] });
      queryClient.invalidateQueries({ queryKey: ["ranking", updatedPitch.eventId] });
      queryClient.invalidateQueries({ queryKey: ["pitch-detail", updatedPitch.id] });
    },
  });
}
