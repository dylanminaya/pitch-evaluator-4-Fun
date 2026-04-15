import { z } from "zod";
import { eventCriterionSchema } from "@workspace/shared/api";

export const eventStatusSchema = z.enum(["OPEN", "CLOSED"]);

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
  criteria: z.array(eventCriterionSchema),
  createdAt: z.string(),
  organizerId: z.string().min(1, "Organizer id is required"),
});

export const createEventSchema = z.object({
  name: z.string()
    .min(3, "Name must have at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  description: z.string()
    .min(5, "Description must have at least 5 characters")
    .max(500, "Description cannot exceed 500 characters"),
  criteria: z.array(eventCriterionSchema).min(4, "At least 4 criteria are required"),
})

export const updateEventStatusSchema = z.object({
  status: eventStatusSchema,
}); 



export const organizerRoleSchema = z.enum(["ORGANIZER"]);

export const invitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "CANCELED",
  "EXPIRED",
])

export const createEventOrganizerInvitationSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: organizerRoleSchema.default("ORGANIZER"),
})

export const acceptEventOrganizerInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required")
})