"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardEventOrganizer } from "@workspace/shared/api";
import { getEventOrganizers } from "@/lib/dashboard-api";

export function useEventOrganizers(eventId?: string) {
  return useQuery<DashboardEventOrganizer[]>({
    queryKey: ["event-organizers", eventId],
    queryFn: () => getEventOrganizers(eventId!),
    enabled: Boolean(eventId),
  });
}
