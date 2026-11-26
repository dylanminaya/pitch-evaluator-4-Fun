"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardEvent, DashboardEventStats } from "@workspace/shared/api";
import { getEventStats, getEvents } from "@/lib/dashboard-api";

const ORGANIZER_REFRESH_INTERVAL_MS = 5000;

export function useEvents() {
    return useQuery<DashboardEvent[]>({
        queryKey: ["events"],
        queryFn: getEvents,
        refetchInterval: ORGANIZER_REFRESH_INTERVAL_MS,
        refetchIntervalInBackground: true,
    });
}

export function useEventStats(eventId?: string) {
    return useQuery<DashboardEventStats>({
        queryKey: ["event-stats", eventId],
        queryFn: () => getEventStats(eventId!),
        enabled: Boolean(eventId),
        refetchInterval: ORGANIZER_REFRESH_INTERVAL_MS,
        refetchIntervalInBackground: true,
    });
}
