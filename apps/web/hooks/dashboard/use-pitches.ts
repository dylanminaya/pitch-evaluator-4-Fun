"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardPitch } from "@workspace/shared/api";
import { getPitches } from "@/lib/dashboard-api";

const ORGANIZER_REFRESH_INTERVAL_MS = 5000;

export function usePitches(eventId?: string) {
    return useQuery<DashboardPitch[]>({
        queryKey: ["pitches", eventId],
        queryFn: () => getPitches(eventId!),
        enabled: Boolean(eventId),
        refetchInterval: ORGANIZER_REFRESH_INTERVAL_MS,
        refetchIntervalInBackground: true,
    });
}
