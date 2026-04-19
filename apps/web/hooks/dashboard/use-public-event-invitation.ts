"use client";

import { useQuery } from "@tanstack/react-query";
import { getPublicEventInvitation } from "@/lib/dashboard-api";

export function usePublicEventInvitation(eventId?: string) {
  return useQuery({
    queryKey: ["public-event-invitation", eventId],
    queryFn: () => getPublicEventInvitation(eventId!),
    enabled: Boolean(eventId),
  });
}
