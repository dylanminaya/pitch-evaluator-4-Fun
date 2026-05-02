"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardEvent, DashboardEventStats } from "@workspace/shared/api";
import { getEventStats, getEvents } from "@/lib/dashboard-api";

export function useEvents() {
    return useQuery<DashboardEvent[]>({
        queryKey: ["events"],
        queryFn: getEvents,
    });
}

export function useEventStats(eventId?: string) {
    return useQuery<DashboardEventStats>({
        queryKey: ["event-stats", eventId],
        queryFn: () => getEventStats(eventId!),
        enabled: Boolean(eventId),
        refetchInterval: 5000,
    });
}
