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

export const criterionAverageSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  weight: z.number().int().min(0).max(100),
  avg: z.number(),
});

const criteriaArraySchema = z
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

const voteCriteriaScoresSchema = z
  .array(voteCriterionScoreSchema)
  .min(2, "At least 2 scores are required")
  .max(6, "No more than 6 scores are allowed")
  .superRefine((criteriaScores, ctx) => {
    const criterionIds = new Set<string>();

    for (const criterion of criteriaScores) {
      if (criterionIds.has(criterion.criterionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each criterion can only be scored once",
        });
        break;
      }

      criterionIds.add(criterion.criterionId);
    }
  });

export const dashboardEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
  createdAt: z.string().nullable(),
  organizerId: z.string(),
  criteria: z.array(eventCriterionSchema),
});

export const dashboardPitchSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
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
  criteriaAverages: z.array(criterionAverageSchema).optional(),
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

export const dashboardVoteSchema = z.object({
  id: z.string(),
  pitchId: z.string(),
  evaluatorId: z.string().nullable(),
  evaluatorEmail: z.string().nullable(),
  criteriaScores: z.array(voteCriterionScoreSchema).optional(),
  innovation: z.number(),
  viability: z.number(),
  impact: z.number(),
  presentation: z.number(),
  comment: z.string().nullable(),
  createdAt: z.string().nullable(),
});

export const dashboardEventQrSchema = z.object({
  id: z.string(),
  name: z.string(),
  publicVoteUrl: z.string().url(),
});

export const dashboardEventStatsSchema = z.object({
  evaluatorsCount: z.number().nullable(),
});

export const publicEventInvitationSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
  pitches: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      color: z.string(),
      logoUrl: z.string().nullable(),
      status: z.enum(["OPEN", "CLOSED"]),
    }),
  ),
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
  criteria: criteriaArraySchema,
});

export const createDashboardPitchSchema = z.object({
  eventId: z.string().min(1, "Event id is required"),
  name: z
    .string()
    .min(3, "Project name must have at least 3 characters")
    .max(25, "Project name cannot exceed 25 characters"),
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
    .max(25, "Project name cannot exceed 25 characters"),
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
  eventId: z.string(),
  name: z.string(),
  description: z.string(),
  pitchStatus: z.enum(["OPEN", "CLOSED"]),
  color: z.string(),
  logoUrl: z.string().nullable(),
  eventStatus: z.enum(["OPEN", "CLOSED"]),
  hasVoted: z.boolean(),
  currentVote: dashboardVoteSchema.nullable().optional(),
  criteria: z.array(eventCriterionSchema),
});

export const createPublicVoteSchema = z.object({
  pitchId: z.string().min(1, "Pitch id is required"),
  evaluatorEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  evaluatorId: z.string().nullable().optional(),
  criteriaScores: voteCriteriaScoresSchema,
  comment: z.string().max(500).optional().nullable(),
});



export const organizerRoleSchema = z.enum(["ORGANIZER"])

export const organizerInvitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "CANCELED",
  "EXPIRED",
])

export const dashboardEventOrganizerSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  userId: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: organizerRoleSchema,
  invitedByUserId: z.string().nullable(),
  createdAt: z.string().nullable(),
})

export const dashboardEventOrganizerInvitationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  email: z.string().email(),
  role: organizerRoleSchema,
  status: organizerInvitationStatusSchema,
  invitedByUserId: z.string().nullable(),
  acceptedByUserId: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string().nullable(),
});

export const organizerInvitationDetailSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  email: z.string().email(),
  role: organizerRoleSchema,
  status: organizerInvitationStatusSchema,
  invitedByEmail: z.string().email(),
  expiresAt: z.string(),
});

export const createEventOrganizerInvitationSchema  = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: organizerRoleSchema.default("ORGANIZER"),
})

export const acceptEventOrganizerInvitationSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

// Inferred types
export type DashboardEvent = z.infer<typeof dashboardEventSchema>;
export type DashboardPitch = z.infer<typeof dashboardPitchSchema>;
export type DashboardRankingItem = z.infer<typeof dashboardRankingItemSchema>;
export type CriterionAverage = z.infer<typeof criterionAverageSchema>;
export type DashboardPitchDetail = z.infer<typeof dashboardPitchDetailSchema>;
export type DashboardPitchComment = z.infer<typeof dashboardPitchCommentSchema>;
export type DashboardVote = z.infer<typeof dashboardVoteSchema>;
export type DashboardPitchQr = z.infer<typeof dashboardEventQrSchema>;
export type DashboardEventStats = z.infer<typeof dashboardEventStatsSchema>;
export type PublicEventInvitation = z.infer<typeof publicEventInvitationSchema>;
export type CreateDashboardEvent = z.infer<typeof createDashboardEventSchema>;
export type CreateDashboardPitch = z.infer<typeof createDashboardPitchSchema>;
export type UpdateDashboardPitch = z.infer<typeof updateDashboardPitchSchema>;
export type EventCriterion = z.infer<typeof eventCriterionSchema>;
export type VoteCriterionScore = z.infer<typeof voteCriterionScoreSchema>;
export type PublicPitch = z.infer<typeof publicPitchSchema>;
export type CreatePublicVote = z.infer<typeof createPublicVoteSchema>;

export type OrganizerRole = z.infer<typeof organizerRoleSchema>;
export type OrganizerInvitationStatus = z.infer<typeof organizerInvitationStatusSchema>;
export type DashboardEventOrganizer = z.infer<typeof dashboardEventOrganizerSchema>;
export type DashboardEventOrganizerInvitation = z.infer<
  typeof dashboardEventOrganizerInvitationSchema
>;
export type OrganizerInvitationDetail = z.infer<
  typeof organizerInvitationDetailSchema
>;
export type CreateEventOrganizerInvitation = z.infer<
  typeof createEventOrganizerInvitationSchema
>;
export type AcceptEventOrganizerInvitation = z.infer<
  typeof acceptEventOrganizerInvitationSchema
>;

// Backward-compatible aliases while the organizer invitation flow settles.
export type dashboardEventOrganizer = DashboardEventOrganizer;
export type dashboardEventOrganizerInvitation = DashboardEventOrganizerInvitation;
export type createEventOrganizerInvitation = CreateEventOrganizerInvitation;
export type acceptEventOrganizerInvitation = AcceptEventOrganizerInvitation;
