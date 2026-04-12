"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type CreateDashboardEvent,
  createDashboardEventSchema,
} from "@workspace/shared/api";
import { createEvent } from "@/lib/dashboard-api";

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDashboardEvent) => {
      const validation = createDashboardEventSchema.safeParse(data);

      if (!validation.success) {
        const firstError = validation.error.issues[0];
        throw new Error(firstError?.message ?? "Invalid event data");
      }

      return createEvent(validation.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
