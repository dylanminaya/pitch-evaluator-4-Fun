"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePitchStatus } from "@/lib/dashboard-api";

export function useUpdatePitchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pitchId,
      status,
    }: {
      pitchId: string;
      status: "OPEN" | "CLOSED";
    }) => updatePitchStatus(pitchId, status),
    onSuccess: (updatedPitch) => {
      queryClient.invalidateQueries({ queryKey: ["pitches", updatedPitch.eventId] });
      queryClient.invalidateQueries({ queryKey: ["ranking", updatedPitch.eventId] });
      queryClient.invalidateQueries({ queryKey: ["public-pitch", updatedPitch.id] });
    },
  });
}
