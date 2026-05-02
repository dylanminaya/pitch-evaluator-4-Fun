"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardPitch } from "@workspace/shared/api";
import { getPitches } from "@/lib/dashboard-api";

export function usePitches(eventId?: string) {
    return useQuery<DashboardPitch[]>({
        queryKey: ["pitches", eventId],
        queryFn: () => getPitches(eventId!),
        enabled: Boolean(eventId),
    });
}
