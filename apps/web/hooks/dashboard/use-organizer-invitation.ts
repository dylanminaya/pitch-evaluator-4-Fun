"use client";

import { useQuery } from "@tanstack/react-query";
import type { OrganizerInvitationDetail } from "@workspace/shared/api";
import { getOrganizerInvitationByToken } from "@/lib/dashboard-api";

export function useOrganizerInvitation(token?: string) {
  return useQuery<OrganizerInvitationDetail>({
    queryKey: ["organizer-invitation", token],
    queryFn: () => getOrganizerInvitationByToken(token!),
    enabled: Boolean(token),
    retry: false,
  });
}
