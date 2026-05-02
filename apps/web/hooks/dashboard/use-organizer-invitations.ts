import { useQuery } from "@tanstack/react-query";
import type { DashboardEventOrganizerInvitation } from "@workspace/shared/api";
import { getOrganizerInvitations } from "@/lib/dashboard-api";

export function useOrganizerInvitations(eventId?: string) {
  return useQuery<DashboardEventOrganizerInvitation[]>({
    queryKey: ["organizer-invitations", eventId],
    queryFn: () => getOrganizerInvitations(eventId!),
    enabled: Boolean(eventId),
  });
}
