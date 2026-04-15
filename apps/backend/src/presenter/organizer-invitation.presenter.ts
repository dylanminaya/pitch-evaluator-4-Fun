import { z } from "zod";
import { dashboardEventOrganizerInvitationSchema } from "@workspace/shared/api";

// Valida la lista final de invitaciones antes de responder al frontend.
export const organizerInvitationListSchema = z.array(
  dashboardEventOrganizerInvitationSchema,
);

// Forma cruda que llega desde la consulta SQL.
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

// Normaliza la fila de DB al formato compartido por la API.
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
    // Las fechas salen como ISO string para mantener la respuesta estable.
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
