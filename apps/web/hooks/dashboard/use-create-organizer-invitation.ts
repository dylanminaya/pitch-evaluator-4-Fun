import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createOrganizerInvitation,
  type CreateEventOrganizerInvitation,
} from "@/lib/dashboard-api";

export function useCreateOrganizerInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: CreateEventOrganizerInvitation;
    }) => createOrganizerInvitation(eventId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizer-invitations", variables.eventId],
      });
    },
  });
}
