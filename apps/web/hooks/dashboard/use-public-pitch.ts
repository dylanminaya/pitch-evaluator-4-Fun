"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicPitch } from "@workspace/shared/api";
import { getPublicPitch } from "@/lib/dashboard-api";

export function usePublicPitch(pitchId?: string, evaluatorEmail?: string | null) {
  return useQuery<PublicPitch>({
    queryKey: ["public-pitch", pitchId, evaluatorEmail],
    queryFn: () => getPublicPitch(pitchId!, evaluatorEmail ?? undefined),
    enabled: Boolean(pitchId),
  });
}
