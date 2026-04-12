"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateEventStatus } from "@/lib/dashboard-api";

export function useUpdateEventStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string;
      status: "OPEN" | "CLOSED";
    }) => updateEventStatus(eventId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
