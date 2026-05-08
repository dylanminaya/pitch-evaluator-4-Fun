import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeOrganizer } from "@/lib/dashboard-api";

export function useRemoveOrganizer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      organizerId,
    }: {
      eventId: string;
      organizerId: string;
    }) => removeOrganizer(eventId, organizerId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["event-organizers", variables.eventId],
      });
    },
  });
}