import { z } from "zod";

export const pitchSchema = z.object({
  id: z.string().min(1, "Id is required"),
  eventId: z.string().min(1, "Event id is required"),
  name: z
    .string()
    .min(3, "Project name must have at least 3 characters")
    .max(150, "Project name cannot exceed 150 characters"),
  description: z
    .string()
    .min(5, "Project description must have at least 5 characters")
    .max(500, "Project description cannot exceed 500 characters"),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a valid hex code"),
  logoUrl: z.string().url().nullable().optional(),
  createdAt: z.string().datetime(),
});

export const createPitchSchema = z.object({
  eventId: z.string().min(1, "Event id is required"),
  name: z
    .string()
    .min(3, "Project name must have at least 3 characters")
    .max(150, "Project name cannot exceed 150 characters"),
  description: z
    .string()
    .min(5, "Project description must have at least 5 characters")
    .max(500, "Project description cannot exceed 500 characters"),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a valid hex code"),
  logoUrl: z.string().url().nullable().optional(),
});

export const updatePitchSchema = z.object({
  name: z
    .string()
    .min(3, "Project name must have at least 3 characters")
    .max(150, "Project name cannot exceed 150 characters"),
  description: z
    .string()
    .min(5, "Project description must have at least 5 characters")
    .max(500, "Project description cannot exceed 500 characters"),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a valid hex code"),
  logoUrl: z.string().url().nullable().optional(),
});
