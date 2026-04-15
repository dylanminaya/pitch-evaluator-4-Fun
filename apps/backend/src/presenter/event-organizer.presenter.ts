import { z } from "zod";
import { dashboardEventOrganizerSchema } from "@workspace/shared/api";

// Valida la lista final de organizers antes de responder al frontend.
export const eventOrganizerListSchema = z.array(dashboardEventOrganizerSchema);

// Forma cruda que llega desde la consulta SQL.
type EventOrganizerRow = {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  name: string | null;
  role: "ORGANIZER";
  invitedByUserId: string | null;
  createdAt?: Date | string | null;
};

// Normaliza la fila de DB al formato compartido por la API.
export function presentEventOrganizer(organizer: EventOrganizerRow) {
  return {
    id: organizer.id,
    eventId: organizer.eventId,
    userId: organizer.userId,
    email: organizer.email,
    name: organizer.name,
    role: organizer.role,
    invitedByUserId: organizer.invitedByUserId,
    // Convierte fechas a string para que el frontend reciba siempre la misma forma.
    createdAt:
      organizer.createdAt instanceof Date
        ? organizer.createdAt.toISOString()
        : (organizer.createdAt ?? null),
  };
}
