import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import { voteSchema } from "./../vote.schema.js";
import { presentPitchRanking, presentVote } from "../../presenter/vote.presenter.js";
import { dashboardRankingItemSchema } from "@workspace/shared/api";

export const voteRouter: Router = Router();

const createVoteSchema = voteSchema.omit({
  id: true,
  createdAt: true,
  ipAddress: true,
});

const getClientIpAddress = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value === "string" && value.length > 0) {
    return value.split(",")[0]?.trim() ?? null;
  }

  return null;
};

voteRouter.get("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const pitchId = req.query.pitchId;

  if (typeof pitchId !== "string" || pitchId.length === 0) {
    return res.status(400).json({ message: "pitchId is required" });
  }

  try {
    const result = await db.query(
      `
        SELECT
          v.id,
          v."pitchId",
          v."evaluatorId",
          v."ipAddress",
          v.innovation,
          v.viability,
          v.impact,
          v.presentation,
          v.comment,
          v."createdAt"
        FROM vote v
        INNER JOIN pitch p ON p.id = v."pitchId"
        INNER JOIN event e ON e.id = p."eventId"
        WHERE v."pitchId" = $1
          AND e."organizerId" = $2
        ORDER BY v."createdAt" DESC
      `,
      [pitchId, session.user.id],
    );

    return res.json(result.rows.map(presentVote));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch votes" });
  }
});

voteRouter.post("/", async (req, res) => {
  const parsed = createVoteSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid vote data",
      errors: parsed.error.flatten(),
    });
  }

  const {
    pitchId,
    evaluatorId,
    innovation,
    viability,
    impact,
    presentation,
    comment,
  } = parsed.data;

  try {
    const pitchResult = await db.query(
      `
        SELECT p.id
        FROM pitch p
        INNER JOIN event e ON e.id = p."eventId"
        WHERE p.id = $1
          AND e.status = 'OPEN'
      `,
      [pitchId],
    );

    if (pitchResult.rowCount === 0) {
      return res.status(404).json({
        message: "Pitch not found or voting is closed",
      });
    }
    //no doble votos
    const ipAddress =
      getClientIpAddress(req.headers["x-forwarded-for"]) ?? req.ip ?? null;

    if(ipAddress) {
      const existingVoteResult = await db.query(
        `
        SELECT id
        FROM vote
        WHERE "pitchId" = $1
          AND "ipAddress" = $2
        LIMIT 1`,
        [pitchId, ipAddress]
      );

      if (existingVoteResult.rowCount !== null && existingVoteResult.rowCount > 0 ) {
        return res.status(409).json({ message: "You have already voted for this pitch",
        });
      }
    }

    let result;

    try {
      result = await db.query(
      `
        INSERT INTO vote (
          id,
          "pitchId",
          "evaluatorId",
          "ipAddress",
          innovation,
          viability,
          impact,
          presentation,
          comment,
          "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING
          id,
          "pitchId",
          "evaluatorId",
          "ipAddress",
          innovation,
          viability,
          impact,
          presentation,
          comment,
          "createdAt"
      `,
      [
        randomUUID(),
        pitchId,
        evaluatorId ?? null,
        ipAddress,
        innovation,
        viability,
        impact,
        presentation,
        comment ?? null,
      ],
    );
  }catch(error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ){
      return res.status(409).json({
        message: "You have already voted for this pitch"
      })
    }
    throw error;
  }

    return res.status(201).json(presentVote(result.rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create vote" });
  }
});

//endpoint ranking
voteRouter.get("/ranking", async (req, res) => {
    const session = await requireSession(req, res)

    if (!session) {
        return;
    }

    const eventId = req.query.eventId;

    if (typeof eventId !== "string" || eventId.length === 0 ) {
        return res.status(400).json({ message: "eventId is required" })
    }

    try {
        const result = await db.query(
      `
        SELECT
          p.id,
          p."eventId",
          p.name,
          p.description,
          p.color,
          p."logoUrl",
          COUNT(v.id)::int AS "votesCount",
          COALESCE(ROUND(AVG(v.innovation)::numeric, 2), 0) AS "innovationAvg",
          COALESCE(ROUND(AVG(v.viability)::numeric, 2), 0) AS "viabilityAvg",
          COALESCE(ROUND(AVG(v.impact)::numeric, 2), 0) AS "impactAvg",
          COALESCE(ROUND(AVG(v.presentation)::numeric, 2), 0) AS "presentationAvg",
          COALESCE(
            ROUND((
              AVG(v.innovation) +
              AVG(v.viability) +
              AVG(v.impact) +
              AVG(v.presentation)
            ) / 4, 2),
            0
          ) AS "scoreAvg"
        FROM pitch p
        INNER JOIN event e ON e.id = p."eventId"
        LEFT JOIN vote v ON v."pitchId" = p.id
        WHERE p."eventId" = $1
          AND e."organizerId" = $2
        GROUP BY
          p.id,
          p."eventId",
          p.name,
          p.description,
          p.color,
          p."logoUrl",
          p."createdAt"
        ORDER BY "scoreAvg" DESC, "votesCount" DESC, p."createdAt" ASC
      `,
      [eventId, session.user.id],
      );
      return res.json(z.array(dashboardRankingItemSchema).parse(result.rows.map(presentPitchRanking)));
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: "Failed to fetch ranking"})
    }
});
