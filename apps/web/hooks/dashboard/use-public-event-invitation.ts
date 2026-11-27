"use client";

import { useQuery } from "@tanstack/react-query";
import { shouldRetryRequest } from "@/lib/api/client";
import { getPublicEventInvitation } from "@/lib/dashboard-api";

export function usePublicEventInvitation(eventId?: string) {
  return useQuery({
    queryKey: ["public-event-invitation", eventId],
    queryFn: () => getPublicEventInvitation(eventId!),
    enabled: Boolean(eventId),
    refetchInterval: 5000,
    // apiFetch no expone el status HTTP; un solo reintento evita esperas largas en 404
    retry: shouldRetryRequest,
  });
}
