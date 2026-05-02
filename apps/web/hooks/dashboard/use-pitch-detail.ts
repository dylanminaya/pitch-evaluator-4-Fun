"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardPitchDetail } from "@workspace/shared/api";
import { getPitchDetail } from "@/lib/dashboard-api";

export function usePitchDetail(pitchId?: string) {
    return useQuery<DashboardPitchDetail>({
        queryKey: ["pitch-detail", pitchId],
        queryFn: () => getPitchDetail(pitchId!),
        enabled: Boolean(pitchId),
    });
}
