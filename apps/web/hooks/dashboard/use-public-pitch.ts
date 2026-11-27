"use client";

import { useQuery } from "@tanstack/react-query";
import { shouldRetryRequest } from "@/lib/api/client";
import type { PublicPitch } from "@workspace/shared/api";
import { getPublicPitch } from "@/lib/dashboard-api";

export function usePublicPitch(pitchId?: string, evaluatorEmail?: string | null) {
  return useQuery<PublicPitch>({
    queryKey: ["public-pitch", pitchId, evaluatorEmail],
    queryFn: () => getPublicPitch(pitchId!, evaluatorEmail ?? undefined),
    enabled: Boolean(pitchId),
    refetchInterval: 5000,
    // apiFetch no expone el status HTTP; un solo reintento evita esperas largas en 404
    retry: shouldRetryRequest,
  });
}
