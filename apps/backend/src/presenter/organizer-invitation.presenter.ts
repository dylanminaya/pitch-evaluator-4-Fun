import { z } from "zod";
import { dashboardEventOrganizerInvitationSchema } from "@workspace/shared/api";

export const organizerInvitationListSchema = z.array(
  dashboardEventOrganizerInvitationSchema,
);

type OrganizerInvitationRow = {
  id: string;
  eventId: string;
  email: string;
  role: "ORGANIZER";
  status: "PENDING" | "ACCEPTED" | "CANCELED" | "EXPIRED";
  invitedByUserId: string | null;
  acceptedByUserId: string | null;
  expiresAt: Date | string;
  createdAt?: Date | string | null;
};

export function presentOrganizerInvitation(
  invitation: OrganizerInvitationRow,
) {
  return {
    id: invitation.id,
    eventId: invitation.eventId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedByUserId: invitation.invitedByUserId,
    acceptedByUserId: invitation.acceptedByUserId,
    expiresAt:
      invitation.expiresAt instanceof Date
        ? invitation.expiresAt.toISOString()
        : invitation.expiresAt,
    createdAt:
      invitation.createdAt instanceof Date
        ? invitation.createdAt.toISOString()
        : (invitation.createdAt ?? null),
  };
}
