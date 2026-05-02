"use client";

import { useQuery } from "@tanstack/react-query";
import type { DashboardPitchQr } from "@workspace/shared/api";
import { getPitchQr } from "@/lib/dashboard-api";

export function usePitchQr(pitchId?: string) {
    return useQuery<DashboardPitchQr>({
        queryKey: ["pitch-qr", pitchId],
        queryFn: () => getPitchQr(pitchId!),
        enabled: Boolean(pitchId),
    });
}
