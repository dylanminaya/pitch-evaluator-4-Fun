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
import { validateServerEnv } from "@workspace/shared/env/server";
import { presentPitch, presentPitchComment, presentPitchDetail,presentPitchSummary, presentPublicPitch } from "../../presenter/pitch.presenter.js";
import {
  dashboardPitchSchema,
  dashboardPitchDetailSchema,
  dashboardPitchCommentSchema,
  publicPitchSchema,
} from "@workspace/shared/api";

export const pitchRouter: Router = Router();

// Criterios por defecto para bases antiguas que todavia no guardan criteria en event.
const defaultCriteria = [
  { id: "innovation", label: "Innovacion", weight: 25, isDefault: true },
  { id: "viability", label: "Viabilidad", weight: 25, isDefault: true },
  { id: "impact", label: "Impacto", weight: 25, isDefault: true },
  { id: "presentation", label: "Presentacion", weight: 25, isDefault: true },
];

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
        INSERT INTO pitch (id, "eventId", name, description, color, "logoUrl", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, "eventId", name, description, color, "logoUrl", "createdAt"
      `,
      [randomUUID(), eventId, name, description, color, logoUrl ?? null],
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
        RETURNING id, "eventId", name, description, color, "logoUrl", "createdAt"
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

    return res.status(200).json(publicPitchSchema.parse({
      ...presentPublicPitch(result.rows[0]),
      criteria: Array.isArray(result.rows[0].criteria) ? result.rows[0].criteria : defaultCriteria,
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
        SELECT
          p.id,
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
        WHERE p.id = $1
        GROUP BY
          p.id,
          p.name,
          p.description,
          p.color,
          p."logoUrl"
      `,
    [req.params.pitchId]
    )

    if (detailResult.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found"})
    }

    const pitch = detailResult.rows[0];

    const aiSummary =
      "AI summary not generated yet. This field will contain the executive summary based on audience comments.";


    const csvHeader = [
      "pitchId",
      "pitchName",
      "description",
      "color",
      "logoUrl",
      "votesCount",
      "innovationAvg",
      "viabilityAvg",
      "impactAvg",
      "presentationAvg",
      "scoreAvg",
      "aiSummary",
    ].join(",")

    const csvRows = [
      pitch.id,
      `"${String(pitch.name).replace(/"/g, '""')}"`,
      `"${String(pitch.description).replace(/"/g, '""')}"`,
      pitch.color,
      pitch.logoUrl ?? "",
      pitch.votesCount,
      pitch.innovationAvg,
      pitch.viabilityAvg,
      pitch.impactAvg,
      pitch.presentationAvg,
      pitch.scoreAvg,
      `"${aiSummary.replace(/"/g, '""')}"`,
    ].join(",")

    const csv = [csvHeader, csvRows].join("\n")

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
