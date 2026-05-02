"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEvent } from "@/lib/dashboard-api";

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      await deleteEvent(eventId);
      return eventId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
