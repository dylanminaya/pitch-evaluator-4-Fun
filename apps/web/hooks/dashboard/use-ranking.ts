"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardRankingItem } from "@workspace/shared/api";
import { getRanking } from "@/lib/dashboard-api";

export function useRanking(eventId?: string) {
    return useQuery<DashboardRankingItem[]>({
        queryKey: ["ranking", eventId],
        queryFn: () => getRanking(eventId!),
        enabled: Boolean(eventId),
        refetchInterval: 5000,
    });
}
