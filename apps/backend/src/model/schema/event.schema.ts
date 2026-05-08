import { z } from "zod";
import { eventCriterionSchema } from "@workspace/shared/api";

const criteriaSchema = z
  .array(eventCriterionSchema)
  .min(2, "At least 2 criteria are required")
  .max(6, "No more than 6 criteria are allowed")
  .superRefine((criteria, ctx) => {
    const totalWeight = criteria.reduce((sum, criterion) => sum + criterion.weight, 0);

    if (totalWeight !== 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Criteria weights must add up to 100%",
      });
    }

    const ids = new Set<string>();

    for (const criterion of criteria) {
      if (ids.has(criterion.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Criterion ids must be unique",
        });
        break;
      }

      ids.add(criterion.id);
    }
  });

// Estados permitidos para un evento.
export const eventStatusSchema = z.enum(["OPEN", "CLOSED"]);

// Forma completa de un evento ya persistido.
export const eventSchema = z.object({
  id: z.string().min(1, "Id is required"),
  name: z
    .string()
    .min(3, "Name must have at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .min(5, "Description must have at least 5 characters")
    .max(500, "Description cannot exceed 500 characters"),
  status: eventStatusSchema,
  criteria: criteriaSchema,
  createdAt: z.string(),
  organizerId: z.string().min(1, "Organizer id is required"),
});

// Payload para crear un evento.
export const createEventSchema = z.object({
  name: z.string()
    .min(3, "Name must have at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string()
    .min(5, "Description must have at least 5 characters")
    .max(500, "Description cannot exceed 500 characters"),
  criteria: criteriaSchema,
})

// Payload minimo para abrir o cerrar un evento.
export const updateEventStatusSchema = z.object({
  status: eventStatusSchema,
}); 

// Rol permitido para organizers invitados.
export const organizerRoleSchema = z.enum(["ORGANIZER"]);

// Estados posibles de una invitacion de organizer.
export const invitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "CANCELED",
  "EXPIRED",
])

// Payload para crear una invitacion de organizer.
export const createEventOrganizerInvitationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: organizerRoleSchema.default("ORGANIZER"),
})

// Payload para aceptar una invitacion por token.
export const acceptEventOrganizerInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required")
})
