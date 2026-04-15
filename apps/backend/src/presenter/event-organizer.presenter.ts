import { z } from "zod";
import { dashboardEventOrganizerSchema } from "@workspace/shared/api";

export const eventOrganizerListSchema = z.array(dashboardEventOrganizerSchema);

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

export function presentEventOrganizer(organizer: EventOrganizerRow) {
  return {
    id: organizer.id,
    eventId: organizer.eventId,
    userId: organizer.userId,
    email: organizer.email,
    name: organizer.name,
    role: organizer.role,
    invitedByUserId: organizer.invitedByUserId,
    createdAt:
      organizer.createdAt instanceof Date
        ? organizer.createdAt.toISOString()
        : (organizer.createdAt ?? null),
  };
}
