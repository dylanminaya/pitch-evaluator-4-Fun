import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelOrganizerInvitation } from "@/lib/dashboard-api";

export function useCancelOrganizerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      invitationId,
    }: {
      eventId: string;
      invitationId: string;
    }) => cancelOrganizerInvitation(eventId, invitationId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizer-invitations", variables.eventId],
      });
    },
  });
}
