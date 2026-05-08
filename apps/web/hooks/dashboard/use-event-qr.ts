"use client";

import { useQuery } from "@tanstack/react-query";
import { getEventQr } from "@/lib/dashboard-api";

export function useEventQr(eventId?: string) {
  return useQuery({
    queryKey: ["event-qr", eventId],
    queryFn: () => getEventQr(eventId!),
    enabled: Boolean(eventId),
  });
}
