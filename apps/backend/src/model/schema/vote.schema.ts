import { z } from "zod";

export const voteSchema = z.object({
  id: z.string().min(1, "Id is required"),
  pitchId: z.string().min(1, "Pitch id is required"),
  evaluatorId: z.string().nullable().optional(),
  ipAddress: z.string().nullable().optional(),
  innovation: z.number().int().min(1).max(5),
  viability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  presentation: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional().nullable(),
  createdAt: z.string().datetime(),
});

export type Vote = z.infer<typeof voteSchema>;
