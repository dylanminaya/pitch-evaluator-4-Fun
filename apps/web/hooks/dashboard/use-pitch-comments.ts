"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginatedPitchComments } from "@workspace/shared/api";
import { getPaginatedPitchComments } from "@/lib/dashboard-api";

export function usePitchComments(pitchId: string | undefined, page: number) {
  return useQuery<PaginatedPitchComments>({
    queryKey: ["pitch-comments-paginated", pitchId, page],
    queryFn: () => getPaginatedPitchComments(pitchId!, page),
    enabled: Boolean(pitchId),
    placeholderData: keepPreviousData,
  });
}
