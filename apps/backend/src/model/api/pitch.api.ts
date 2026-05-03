import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import {
  createPitchSchema,
  updatePitchSchema,
  updatePitchStatusSchema,
} from "../schema/pitch.schema.js";
import { canManageEvent, getEventIdForPitch } from "../event.permissions.js";
import {
  buildCriteriaAveragesSql,
  buildWeightedScoreSql,
  normalizeEventCriteria,
} from "../criteria.js";
import { validateServerEnv } from "@workspace/shared/env/server";
import { presentVote } from "../../presenter/vote.presenter.js";
import { presentPitch, presentPitchComment, presentPitchDetail,presentPitchSummary, presentPublicPitch } from "../../presenter/pitch.presenter.js";
import {
  dashboardPitchSchema,
  dashboardPitchDetailSchema,
  dashboardPitchCommentSchema,
  publicPitchSchema,
} from "@workspace/shared/api";

export const pitchRouter: Router = Router();

// Detecta errores de Postgres por codigo para aplicar fallbacks de schema.
const hasPgErrorCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

// Lista los pitches de un evento.
pitchRouter.get("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const eventId = req.query.eventId;

  if (typeof eventId !== "string" || eventId.length === 0) {
    return res.status(400).json({ message: "eventId is required" });
  }

  try {
    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        SELECT p.id, p."eventId", p.name, p.description, p.status, p.color, p."logoUrl", p."createdAt"
        FROM pitch p
        WHERE p."eventId" = $1
        ORDER BY p."createdAt" DESC
      `,
      [eventId],
    );

    return res.json(z.array(dashboardPitchSchema).parse(result.rows.map(presentPitch)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch pitches" });
  }
});

// Cambia solo el estado del pitch.
pitchRouter.patch("/:id/status", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = updatePitchStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid pitch status",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const eventId = await getEventIdForPitch(req.params.id);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        UPDATE pitch
        SET status = $1
        WHERE id = $2
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "createdAt"
      `,
      [parsed.data.status, req.params.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update pitch status" });
  }
});

// Crea un pitch nuevo dentro de un evento.
pitchRouter.post("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  // Valida el body con Zod antes de tocar la DB.
  const parsed = createPitchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid pitch data",
      errors: parsed.error.flatten(),
    });
  }
  // Datos ya validados.
  const { eventId, name, description, color, logoUrl } = parsed.data;

  try {
    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        INSERT INTO pitch (id, "eventId", name, description, status, color, "logoUrl", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "createdAt"
      `,
      [randomUUID(), eventId, name, description, "OPEN", color, logoUrl ?? null],
    );

    return res.status(201).json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create pitch" });
  }
});

// Actualiza un pitch existente.
pitchRouter.patch("/:id", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = updatePitchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid pitch data",
      errors: parsed.error.flatten(),
    });
  }

  const { name, description, color, logoUrl } = parsed.data;

  try {
    const eventId = await getEventIdForPitch(req.params.id);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        UPDATE pitch
        SET
          name = $1,
          description = $2,
          color = $3,
          "logoUrl" = $4
        WHERE id = $5
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "createdAt"
      `,
      [name, description, color, logoUrl ?? null, req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update pitch" });
  }
});

// Elimina un pitch.
pitchRouter.delete("/:id", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.id);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        DELETE FROM pitch
        WHERE id = $1
      `,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete pitch" });
  }
});

// Endpoint publico para la pantalla de voto.
pitchRouter.get("/public/:pitchId", async (req, res) => {
  try {
    const evaluatorEmailParam = req.query.evaluatorEmail;
    let evaluatorEmail: string | null = null;

    if (typeof evaluatorEmailParam === "string" && evaluatorEmailParam.length > 0) {
      const parsedEmail = z.string().trim().toLowerCase().email().safeParse(evaluatorEmailParam);

      if (!parsedEmail.success) {
        return res.status(400).json({ message: "Invalid evaluator email" });
      }

      evaluatorEmail = parsedEmail.data;
    }

    let result;

    try {
      // Intenta traer tambien los criterios del evento si la columna existe.
      result = await db.query(
        `
          SELECT
            p.id,
            p."eventId",
            p.name,
            p.description,
            p.status AS "pitchStatus",
            p.color,
            p."logoUrl",
            e.status AS "eventStatus",
            e.criteria
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          WHERE p.id = $1
        `,
        [req.params.pitchId],
      );
    } catch (error) {
      // Fallback para bases viejas sin `criteria`.
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
            p.status AS "pitchStatus",
            p.color,
            p."logoUrl",
            e.status AS "eventStatus"
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          WHERE p.id = $1
        `,
        [req.params.pitchId],
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Pitch not found",
      });
    }

    let currentVote = null;

    if (evaluatorEmail) {
      try {
        const existingVoteResult = await db.query(
          `
            SELECT
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
            FROM vote
            WHERE "pitchId" = $1
              AND "evaluatorEmail" = $2
            LIMIT 1
          `,
          [req.params.pitchId, evaluatorEmail],
        );

        currentVote =
          (existingVoteResult.rowCount ?? 0) > 0
            ? presentVote(existingVoteResult.rows[0])
            : null;
      } catch (error) {
        if (!hasPgErrorCode(error, "42703")) {
          throw error;
        }

        const existingVoteResult = await db.query(
          `
            SELECT
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
            FROM vote
            WHERE "pitchId" = $1
              AND "evaluatorId" = $2
            LIMIT 1
          `,
          [req.params.pitchId, evaluatorEmail],
        );

        currentVote =
          (existingVoteResult.rowCount ?? 0) > 0
            ? presentVote(existingVoteResult.rows[0])
            : null;
      }
    }

    return res.status(200).json(publicPitchSchema.parse({
      ...presentPublicPitch({
        ...result.rows[0],
        hasVoted: Boolean(currentVote),
        currentVote,
      }),
      criteria: normalizeEventCriteria(result.rows[0].criteria),
    }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to get pitch" });
  }
});

// Devuelve el resumen detallado de un pitch para dashboard.
pitchRouter.get("/detail/:pitchId", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({
        message: "Pitch not found",
      });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

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
        COALESCE(ROUND(AVG(v.presentation)::numeric, 2), 0) AS "presentationAvg"
      FROM pitch p
      LEFT JOIN vote v ON v."pitchId" = p.id
      WHERE p.id = $1
      GROUP BY
        p.id,
        p."eventId",
        p.name,
        p.description,
        p.color,
        p."logoUrl"
      `,
      [req.params.pitchId],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Pitch not found",

      })
    }

    return res.status(200).json(dashboardPitchDetailSchema.parse(presentPitchDetail(result.rows[0])))
  }catch(e) {
    console.error(e)
    return res.status(500).json({ message: "Failed to fetch pitch detail"})
  }
});

// Lista comentarios escritos en los votos del pitch.
pitchRouter.get("/comments", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  const pitchId = req.query.pitchId

  if (typeof pitchId !== "string" || pitchId.length === 0) {
    return res.status(400).json({ message: "pitchId is required"})
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
      `SELECT
        v.id,
        v.comment,
        v."createdAt"
      FROM vote v
      WHERE v."pitchId" = $1
        AND v.comment IS NOT null
        AND TRIM(v.comment) <> ''
      ORDER BY v."createdAt" DESC
      `,
      [pitchId]
    );

    res.status(200).json(z.array(dashboardPitchCommentSchema).parse(result.rows.map(presentPitchComment)))
  } catch (error){
    console.log(error)
    res.status(500).json({ message: "Failed to fetch comments"})
  }
})

// Variables usadas para construir URLs publicas.
const env = validateServerEnv()

// Devuelve la URL publica del pitch para generar QR.
pitchRouter.get("/:pitchId/qr", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `SELECT
        p.id,
        p.name
      FROM pitch p
      WHERE p.id = $1
        `,
      [req.params.pitchId],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" })
    }

    const pitch = result.rows[0]

    // Esta URL es la que luego se convierte en QR.
    const publicVoteUrl = `${env.FRONTEND_URL}/vote/${pitch.id}`;

    return res.json({
      id: pitch.id,
      name: pitch.name,
      publicVoteUrl,
    })
  } catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Failed to generate pitch access URL" })
  }
})

// Prepara los comentarios que luego podria resumir una IA.
pitchRouter.post("/:pitchId/summary", async (req, res) => {
  const session = await requireSession(req, res)

  if (!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const pitchResult = await db.query(
      `
      SELECT
        p.id,
        p.name
      FROM pitch p
      WHERE p.id = $1
        `,
        [req.params.pitchId],
    )

    if (pitchResult.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" })
    }
    
    const commentsResult = await db.query(
      `
      SELECT
        v.id,
        v.comment,
        v."createdAt"
      FROM vote v
      WHERE v."pitchId" = $1
        AND v.comment IS NOT null
        AND TRIM(v.comment) <> ''
      ORDER by v."createdAt" DESC
      `,
      [req.params.pitchId],
    )

    const pitch = pitchResult.rows[0]
    const comments = commentsResult.rows;

    res.json(
      presentPitchSummary({ 
        pitchId: pitch.id,
        pitchName: pitch.name,
        commentsCount: comments.length,
        comments,
        summary: null,
        status: "PENDING_AI",
        message: "Comments collected successfully. AI summary not implemented yet"
      })
    )
  }catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Failed to prepare pitch summary"})
  }
})

// Exporta el reporte de un pitch en CSV.
pitchRouter.get("/:pitchId/export", async (req, res) => {
  const session = await requireSession(req, res)

  if (!session){
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found"});
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const detailResult = await db.query(
      `
        WITH pitch_stats AS (
          SELECT
            p.id,
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
          WHERE p.id = $1
          GROUP BY
            p.id,
            e.criteria
        )
        SELECT
          p.id,
          p.name,
          p.description,
          p.status,
          e.criteria,
          ps."votesCount",
          ps."innovationAvg",
          ps."viabilityAvg",
          ps."impactAvg",
          ps."presentationAvg",
          ps."scoreAvg",
          ps."criteriaAverages",
          v."evaluatorEmail",
          v."criteriaScores",
          v.innovation,
          v.viability,
          v.impact,
          v.presentation,
          v.comment
        FROM pitch p
        INNER JOIN event e ON e.id = p."eventId"
        INNER JOIN pitch_stats ps ON ps.id = p.id
        LEFT JOIN vote v ON v."pitchId" = p.id
        WHERE p.id = $1
        ORDER BY v."createdAt" ASC
      `,
    [req.params.pitchId]
    )

    if (detailResult.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found"})
    }

    const pitch = detailResult.rows[0];

    const escapeCsvValue = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const eventCriteria = normalizeEventCriteria(pitch.criteria);

    const getVoteScore = (row: Record<string, unknown>, criterionId: string) => {
      const scores = Array.isArray(row.criteriaScores) ? row.criteriaScores : [];
      const scoreItem = scores.find(
        (item): item is { criterionId: string; score: number } =>
          typeof item === "object" &&
          item !== null &&
          "criterionId" in item &&
          "score" in item &&
          item.criterionId === criterionId,
      );

      if (scoreItem) {
        return Number(scoreItem.score);
      }

      const legacyScores = new Map<string, unknown>([
        ["innovation", row.innovation],
        ["viability", row.viability],
        ["impact", row.impact],
        ["presentation", row.presentation],
      ]);

      const score = legacyScores.get(criterionId);
      return score == null ? "" : Number(score);
    };

    const getAverageScore = (row: Record<string, unknown>, criterionId: string) => {
      const averages = Array.isArray(row.criteriaAverages) ? row.criteriaAverages : [];
      const averageItem = averages.find(
        (item): item is { id: string; avg: number } =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "avg" in item &&
          item.id === criterionId,
      );

      if (averageItem) {
        return Number(averageItem.avg);
      }

      const legacyAverages = new Map<string, unknown>([
        ["innovation", row.innovationAvg],
        ["viability", row.viabilityAvg],
        ["impact", row.impactAvg],
        ["presentation", row.presentationAvg],
      ]);

      return Number(legacyAverages.get(criterionId) ?? 0);
    };

    const getVoteAverage = (row: Record<string, unknown>) => {
      const weightedTotal = eventCriteria.reduce((sum, criterion) => {
        const score = getVoteScore(row, criterion.id);
        return score === "" ? sum : sum + Number(score) * criterion.weight;
      }, 0);

      const totalWeight = eventCriteria.reduce((sum, criterion) => {
        const score = getVoteScore(row, criterion.id);
        return score === "" ? sum : sum + criterion.weight;
      }, 0);

      return totalWeight === 0 ? "" : Number((weightedTotal / totalWeight).toFixed(2));
    };

    const csvHeader = [
      "pitch",
      "email",
      "votos",
      "Total AVG",
      "porcentaje",
      "promedio",
      ...eventCriteria.map((criterion) => criterion.label),
      ...eventCriteria.map((criterion) => `${criterion.label} Promedio`),
      "Comentario",
      "descripcion",
    ]
      .map((value) => escapeCsvValue(value))
      .join(",")

    const csvRows = detailResult.rows.map((row) => {
      const voteAverage = getVoteAverage(row);

      return [
        escapeCsvValue(row.name),
        escapeCsvValue(row.evaluatorEmail),
        row.votesCount,
        escapeCsvValue(
          voteAverage === "" ? "" : `${(Number(voteAverage) * 20).toFixed(1)}%`,
        ),
        escapeCsvValue(`${(Number(row.scoreAvg) * 20).toFixed(1)}%`),
        row.scoreAvg,
        ...eventCriteria.map((criterion) => getVoteScore(row, criterion.id)),
        ...eventCriteria.map((criterion) => getAverageScore(row, criterion.id)),
        escapeCsvValue(row.comment),
        escapeCsvValue(row.description),
      ].join(",")
    })

    const csv = [csvHeader, ...csvRows].join("\n")

    const pitchName = String(pitch.name)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
    
    // Indica al navegador que la respuesta es un CSV descargable.
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pitchName || "pitch"}-report.csv"`,
    );

    return res.status(200).send(csv)
  }catch(error){
    console.error(error)
    return res.status(500).json({ message: "Failed to export pitch report"})
  }
})








