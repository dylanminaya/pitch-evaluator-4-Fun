"use client";

import { useMutation } from "@tanstack/react-query";
import { acceptOrganizerInvitation } from "@/lib/dashboard-api";

export function useAcceptOrganizerInvitation() {
  return useMutation({
    mutationFn: async (token: string) => acceptOrganizerInvitation(token),
  });
}
