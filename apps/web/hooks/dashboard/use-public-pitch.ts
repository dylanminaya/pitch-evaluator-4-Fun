"use client";

import { useQuery } from "@tanstack/react-query";
import type { PublicPitch } from "@workspace/shared/api";
import { getPublicPitch } from "@/lib/dashboard-api";

export function usePublicPitch(pitchId?: string) {
  return useQuery<PublicPitch>({
    queryKey: ["public-pitch", pitchId],
    queryFn: () => getPublicPitch(pitchId!),
    enabled: Boolean(pitchId),
  });
}
