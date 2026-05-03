import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import { createPublicVoteSchema } from "@workspace/shared/api";
import { presentPitchRanking, presentVote } from "../../presenter/vote.presenter.js";
import { dashboardRankingItemSchema } from "@workspace/shared/api";
import { canManageEvent, getEventIdForPitch } from "../event.permissions.js";
import {
  buildCriteriaAveragesSql,
  buildWeightedScoreSql,
  getScoreByCriterionId,
  normalizeEventCriteria,
  validateCriteriaScores,
} from "../criteria.js";

export const voteRouter: Router = Router();

// Detecta errores de Postgres por codigo para aplicar fallbacks o respuestas claras.
const hasPgErrorCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

// Lista los votos de un pitch para dashboard.
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
    const eventId = await getEventIdForPitch(pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        SELECT
          v.id,
          v."pitchId",
          v."evaluatorId",
          v."evaluatorEmail",
          v."criteriaScores",
          v.innovation,
          v.viability,
          v.impact,
          v.presentation,
          v.comment,
          v."createdAt"
        FROM vote v
        WHERE v."pitchId" = $1
        ORDER BY v."createdAt" DESC
      `,
      [pitchId],
    );

    return res.json(result.rows.map(presentVote));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch votes" });
  }
});

// Registra un voto publico.
voteRouter.post("/", async (req, res) => {
  const parsed = createPublicVoteSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid vote data",
      errors: parsed.error.flatten(),
    });
  }

  const {
    pitchId,
    evaluatorId,
    evaluatorEmail,
    criteriaScores,
    comment,
  } = parsed.data;

  try {
    let pitchResult;

    try {
      pitchResult = await db.query(
        `
          SELECT
            p.id,
            e.criteria
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          WHERE p.id = $1
            AND e.status = 'OPEN'
            AND p.status = 'OPEN'
        `,
        [pitchId],
      );
    } catch (error) {
      if (!hasPgErrorCode(error, "42703")) {
        throw error;
      }

      pitchResult = await db.query(
        `
          SELECT p.id
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          WHERE p.id = $1
            AND e.status = 'OPEN'
            AND p.status = 'OPEN'
        `,
        [pitchId],
      );
    }

    if (pitchResult.rowCount === 0) {
      return res.status(404).json({
        message: "Pitch not found or voting is closed",
      });
    }

    const eventCriteria = normalizeEventCriteria(pitchResult.rows[0].criteria);
    const criteriaValidationError = validateCriteriaScores(criteriaScores, eventCriteria);

    if (criteriaValidationError) {
      return res.status(400).json({ message: criteriaValidationError });
    }

    const legacyScoreFallback =
      criteriaScores.length > 0
        ? Math.round(
            criteriaScores.reduce((sum, criterion) => sum + criterion.score, 0) /
              criteriaScores.length,
          )
        : 3;
    const innovation = getScoreByCriterionId(criteriaScores, "innovation") ?? legacyScoreFallback;
    const viability = getScoreByCriterionId(criteriaScores, "viability") ?? legacyScoreFallback;
    const impact = getScoreByCriterionId(criteriaScores, "impact") ?? legacyScoreFallback;
    const presentation = getScoreByCriterionId(criteriaScores, "presentation") ?? legacyScoreFallback;

    let existingVoteResult;

    try {
      existingVoteResult = await db.query(
        `
        SELECT id
        FROM vote
        WHERE "pitchId" = $1
          AND "evaluatorEmail" = $2
        LIMIT 1`,
        [pitchId, evaluatorEmail]
      );
    } catch (error) {
      if (!hasPgErrorCode(error, "42703")) {
        throw error;
      }

      existingVoteResult = await db.query(
        `
        SELECT id
        FROM vote
        WHERE "pitchId" = $1
          AND "evaluatorId" = $2
        LIMIT 1`,
        [pitchId, evaluatorEmail]
      );
    }

    if (existingVoteResult.rowCount !== null && existingVoteResult.rowCount > 0 ) {
      try {
        const result = await db.query(
          `
            UPDATE vote
            SET
              "evaluatorId" = $1,
              "evaluatorEmail" = $2,
              "criteriaScores" = $3::jsonb,
              innovation = $4,
              viability = $5,
              impact = $6,
              presentation = $7,
              comment = $8
            WHERE id = $9
            RETURNING
              id,
              "pitchId",
              "evaluatorId",
              "evaluatorEmail",
              "criteriaScores",
              innovation,
              viability,
              impact,
              presentation,
              comment,
              "createdAt"
          `,
          [
            evaluatorId ?? null,
            evaluatorEmail,
            JSON.stringify(criteriaScores),
            innovation,
            viability,
            impact,
            presentation,
            comment ?? null,
            existingVoteResult.rows[0].id,
          ],
        );

        return res.status(200).json(presentVote(result.rows[0]));
      } catch (error) {
        if (!hasPgErrorCode(error, "42703")) {
          throw error;
        }

        const result = await db.query(
          `
            UPDATE vote
            SET
              "evaluatorId" = $1,
              innovation = $2,
              viability = $3,
              impact = $4,
              presentation = $5,
              comment = $6
            WHERE id = $7
            RETURNING
              id,
              "pitchId",
              "evaluatorId",
              "evaluatorId" AS "evaluatorEmail",
              innovation,
              viability,
              impact,
              presentation,
              comment,
              "createdAt"
          `,
          [
            evaluatorId ?? evaluatorEmail,
            innovation,
            viability,
            impact,
            presentation,
            comment ?? null,
            existingVoteResult.rows[0].id,
          ],
        );

        return res.status(200).json(presentVote(result.rows[0]));
      }
    }

    let result;

    try {
      try {
        result = await db.query(
          `
            INSERT INTO vote (
              id,
              "pitchId",
              "evaluatorId",
              "evaluatorEmail",
              "criteriaScores",
              innovation,
              viability,
              impact,
              presentation,
              comment,
              "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, NOW())
            RETURNING
              id,
              "pitchId",
              "evaluatorId",
              "evaluatorEmail",
              "criteriaScores",
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
            evaluatorEmail,
            JSON.stringify(criteriaScores),
            innovation,
            viability,
            impact,
            presentation,
            comment ?? null,
          ],
        );
      } catch (error) {
        if (!hasPgErrorCode(error, "42703")) {
          throw error;
        }

        try {
          // Fallback para bases viejas sin `criteriaScores`.
          result = await db.query(
            `
              INSERT INTO vote (
                id,
                "pitchId",
                "evaluatorId",
                "evaluatorEmail",
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
                "evaluatorEmail",
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
              evaluatorEmail,
              innovation,
              viability,
              impact,
              presentation,
              comment ?? null,
            ],
          );
        } catch (fallbackError) {
          if (!hasPgErrorCode(fallbackError, "42703")) {
            throw fallbackError;
          }

          try {
            // Fallback para bases viejas sin `evaluatorEmail`.
            result = await db.query(
              `
                INSERT INTO vote (
                  id,
                  "pitchId",
                  "evaluatorId",
                  "criteriaScores",
                  innovation,
                  viability,
                  impact,
                  presentation,
                  comment,
                  "createdAt"
                )
                VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, NOW())
                RETURNING
                  id,
                  "pitchId",
                  "evaluatorId",
                  "evaluatorId" AS "evaluatorEmail",
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
                evaluatorId ?? evaluatorEmail,
                JSON.stringify(criteriaScores),
                innovation,
                viability,
                impact,
                presentation,
                comment ?? null,
              ],
            );
          } catch (legacyError) {
            if (!hasPgErrorCode(legacyError, "42703")) {
              throw legacyError;
            }

            // Fallback para bases viejas sin `evaluatorEmail` ni `criteriaScores`.
            result = await db.query(
              `
                INSERT INTO vote (
                  id,
                  "pitchId",
                  "evaluatorId",
                  innovation,
                  viability,
                  impact,
                  presentation,
                  comment,
                  "createdAt"
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                RETURNING
                  id,
                  "pitchId",
                  "evaluatorId",
                  "evaluatorId" AS "evaluatorEmail",
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
                evaluatorId ?? evaluatorEmail,
                innovation,
                viability,
                impact,
                presentation,
                comment ?? null,
              ],
            );
          }
        }
      }
    } catch(error) {
    if (
      hasPgErrorCode(error, "23505")
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

// Devuelve el ranking de pitches de un evento.
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
      const canManage = await canManageEvent(session.user.id, eventId);

      if (!canManage) {
        return res.status(403).json({ message: "Forbidden" });
      }

        let result;

        try {
          result = await db.query(
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
                ${buildWeightedScoreSql("v", "e.criteria")} AS "scoreAvg",
                ${buildCriteriaAveragesSql("p", "e.criteria")} AS "criteriaAverages"
              FROM pitch p
              INNER JOIN event e ON e.id = p."eventId"
              LEFT JOIN vote v ON v."pitchId" = p.id
              WHERE p."eventId" = $1
              GROUP BY
                p.id,
                p."eventId",
                p.name,
                p.description,
                p.color,
                p."logoUrl",
                e.criteria,
                p."createdAt"
              ORDER BY "scoreAvg" DESC, "votesCount" DESC, p."createdAt" ASC
            `,
            [eventId],
          );
        } catch (error) {
          if (!hasPgErrorCode(error, "42703")) {
            throw error;
          }

          result = await db.query(
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
              LEFT JOIN vote v ON v."pitchId" = p.id
              WHERE p."eventId" = $1
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
            [eventId],
          );
        }
      return res.json(z.array(dashboardRankingItemSchema).parse(result.rows.map(presentPitchRanking)));
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: "Failed to fetch ranking"})
    }
});
