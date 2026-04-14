import { z } from "zod";

export const eventCriterionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  isDefault: z.boolean().optional(),
});

export const voteCriterionScoreSchema = z.object({
  criterionId: z.string(),
  score: z.number().int().min(1).max(5),
});

export const dashboardEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
  createdAt: z.string().nullable(),
  organizerId: z.string(),
});

export const dashboardPitchSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  logoUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
});

export const dashboardRankingItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  logoUrl: z.string().nullable(),
  votesCount: z.number(),
  innovationAvg: z.number(),
  viabilityAvg: z.number(),
  impactAvg: z.number(),
  presentationAvg: z.number(),
  scoreAvg: z.number(),
});

export const dashboardPitchDetailSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  logoUrl: z.string().nullable(),
  votesCount: z.number(),
  innovationAvg: z.number(),
  viabilityAvg: z.number(),
  impactAvg: z.number(),
  presentationAvg: z.number(),
});

export const dashboardPitchCommentSchema = z.object({
  id: z.string(),
  comment: z.string(),
  createdAt: z.string(),
});

export const dashboardEventQrSchema = z.object({
  id: z.string(),
  name: z.string(),
  publicVoteUrl: z.string().url(),
});

export const publicEventInvitationSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
  targetPitch: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    color: z.string(),
    logoUrl: z.string().nullable(),
  }).nullable(),
});

export const createDashboardEventSchema = z.object({
  name: z
    .string()
    .min(3, "Name must have at least 3 characters")
    .max(100, "Name cannot exceed 100 characters"),
  description: z
    .string()
    .min(5, "Description must have at least 5 characters")
    .max(500, "Description cannot exceed 500 characters"),
  criteria: z.array(eventCriterionSchema).min(4, "At least 4 criteria are required"),
});

export const createDashboardPitchSchema = z.object({
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

export const updateDashboardPitchSchema = z.object({
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

export const publicPitchSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  logoUrl: z.string().nullable(),
  eventStatus: z.enum(["OPEN", "CLOSED"]),
  criteria: z.array(eventCriterionSchema),
});

export const createPublicVoteSchema = z.object({
  pitchId: z.string().min(1, "Pitch id is required"),
  evaluatorId: z.string().nullable().optional(),
  criteriaScores: z.array(voteCriterionScoreSchema).min(4, "At least 4 scores are required"),
  comment: z.string().max(500).optional().nullable(),
});

// Inferred types
export type DashboardEvent = z.infer<typeof dashboardEventSchema>;
export type DashboardPitch = z.infer<typeof dashboardPitchSchema>;
export type DashboardRankingItem = z.infer<typeof dashboardRankingItemSchema>;
export type DashboardPitchDetail = z.infer<typeof dashboardPitchDetailSchema>;
export type DashboardPitchComment = z.infer<typeof dashboardPitchCommentSchema>;
export type DashboardPitchQr = z.infer<typeof dashboardEventQrSchema>;
export type PublicEventInvitation = z.infer<typeof publicEventInvitationSchema>;
export type CreateDashboardEvent = z.infer<typeof createDashboardEventSchema>;
export type CreateDashboardPitch = z.infer<typeof createDashboardPitchSchema>;
export type UpdateDashboardPitch = z.infer<typeof updateDashboardPitchSchema>;
export type EventCriterion = z.infer<typeof eventCriterionSchema>;
export type VoteCriterionScore = z.infer<typeof voteCriterionScoreSchema>;
export type PublicPitch = z.infer<typeof publicPitchSchema>;
export type CreatePublicVote = z.infer<typeof createPublicVoteSchema>;
