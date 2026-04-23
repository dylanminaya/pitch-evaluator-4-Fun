import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import { createEventSchema, updateEventStatusSchema } from "../schema/event.schema.js";
import { canManageEvent } from "../event.permissions.js";
import { presentEvent, presentEventQr } from "../../presenter/event.presenter.js";
import {
  dashboardEventSchema,
  dashboardEventQrSchema,
  dashboardEventStatsSchema,
  publicEventInvitationSchema,
} from "@workspace/shared/api";
import { validateServerEnv } from "@workspace/shared/env/server";
import { normalizeEventCriteria } from "../criteria.js";

export const eventRouter: Router = Router();

// Detecta errores de Postgres por codigo para aplicar fallbacks de schema.
const hasPgErrorCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

// Devuelve la vista publica del evento usada por el link/QR de invitacion general.
eventRouter.get("/public/:eventId", async (req, res) => {
  try {
    const eventResult = await db.query(
      `
        SELECT
          e.id,
          e.name,
          e.status
        FROM event e
        WHERE e.id = $1
      `,
      [req.params.eventId],
    );

    if (eventResult.rowCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const pitchResult = await db.query(
      `
        SELECT
          p.id,
          p.name,
          p.description,
          p.color,
          p."logoUrl",
          p.status
        FROM pitch p
        WHERE p."eventId" = $1
        ORDER BY p."createdAt" DESC
      `,
      [req.params.eventId],
    );

    const event = eventResult.rows[0];

    return res.json(
      publicEventInvitationSchema.parse({
        id: event.id,
        name: event.name,
        status: event.status,
        pitches: pitchResult.rows.map((pitch) => ({
          id: pitch.id,
          name: pitch.name,
          description: pitch.description,
          color: pitch.color,
          logoUrl: pitch.logoUrl ?? null,
          status: pitch.status,
        })),
      }),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch public event invitation" });
  }
});

// Lista los eventos donde el usuario es owner o co-organizer.
eventRouter.get("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const result = await db.query(
      `
        SELECT DISTINCT
          e.id,
          e.name,
          e.description,
          e.status,
          e."createdAt",
          e."organizerId",
          e.criteria
        FROM event e
        LEFT JOIN event_organizer eo ON eo."eventId" = e.id
        WHERE e."organizerId" = $1
          OR eo."userId" = $1
        ORDER BY "createdAt" DESC
      `,
      [session.user.id],
    );

    res.json(
      z.array(dashboardEventSchema).parse(result.rows.map(presentEvent)),
    );
  } catch (error) {
    if (!hasPgErrorCode(error, "42703")) {
      console.error(error);
      return res.status(500).json({ message: "Failed to fetch events" });
    }

    try {
      const fallbackResult = await db.query(
        `
          SELECT DISTINCT
            e.id,
            e.name,
            e.description,
            e.status,
            e."createdAt",
            e."organizerId"
          FROM event e
          LEFT JOIN event_organizer eo ON eo."eventId" = e.id
          WHERE e."organizerId" = $1
            OR eo."userId" = $1
          ORDER BY "createdAt" DESC
        `,
        [session.user.id],
      );

      res.json(
        z.array(dashboardEventSchema).parse(
          fallbackResult.rows.map((event) =>
            presentEvent({
              ...event,
              criteria: normalizeEventCriteria(undefined),
            }),
          ),
        ),
      );
    } catch (fallbackError) {
      console.error(fallbackError);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  }
});

// Crea un evento nuevo para el organizer autenticado.
eventRouter.post("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = createEventSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid event data",
      errors: parsed.error.flatten(),
    });
  }

  const { name, description, criteria } = parsed.data;

  try {
    const eventId = randomUUID();
    let result;

    try {
      // Intenta insertar tambien los criterios si la DB ya tiene esa columna.
      result = await db.query(
        `
          INSERT INTO event (id, name, description, status, criteria, "createdAt", "organizerId")
          VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)
          RETURNING id, name, description, status, "createdAt", "organizerId"
        `,
        [eventId, name, description, "OPEN", JSON.stringify(criteria), session.user.id],
      );
    } catch (error) {
      // Fallback para bases viejas que todavia no tienen `criteria`.
      if (!hasPgErrorCode(error, "42703")) {
        throw error;
      }

      result = await db.query(
        `
          INSERT INTO event (id, name, description, status, "createdAt", "organizerId")
          VALUES ($1, $2, $3, $4, NOW(), $5)
          RETURNING id, name, description, status, "createdAt", "organizerId"
        `,
        [eventId, name, description, "OPEN", session.user.id],
      );
    }

    res.status(201).json(
      dashboardEventSchema.parse(
        presentEvent({
          ...result.rows[0],
          criteria,
        }),
      ),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create event" });
  }
});

// Abre o cierra un evento.
eventRouter.patch("/:id/status", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = updateEventStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid status",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const canManage = await canManageEvent(session.user.id, req.params.id);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        UPDATE event
        SET status = $1
        WHERE id = $2
        RETURNING id, name, description, status, "createdAt", "organizerId"
      `,
      [parsed.data.status, req.params.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(
      dashboardEventSchema.parse(
        presentEvent({
          ...result.rows[0],
          criteria: normalizeEventCriteria(undefined),
        }),
      ),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update event status" });
  }
});

// Elimina un evento si el usuario tiene acceso.
eventRouter.delete("/:id", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const canManage = await canManageEvent(session.user.id, req.params.id);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        DELETE FROM event
        WHERE id = $1
      `,
      [req.params.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

// Exporta el ranking completo del evento en CSV.
eventRouter.get("/:eventId/export", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const canManage = await canManageEvent(session.user.id, req.params.eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const eventResult = await db.query(
      `
      SELECT id, name
      FROM event
      WHERE id = $1
      `,
      [req.params.eventId],
    );

    if ((eventResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const result = await db.query(
      `
      SELECT
        p.id AS pitchId,
        p.name AS pitchName,
        p.description AS "pitchDescription",
        p.status AS "pitchStatus",
        COUNT(v.id)::int AS "votesCount",
        COALESCE(ROUND(AVG(v.innovation)::numeric, 2), 0) AS "innovationAvg",
        COALESCE(ROUND(AVG(v.viability)::numeric, 2), 0) AS "viabilityAvg",
        COALESCE(ROUND(AVG(v.impact)::numeric, 2),0) AS "impactAvg",
        COALESCE(ROUND(AVG(v.presentation)::numeric, 2),0) AS "presentationAvg",
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
        GROUP by p.id, p.name, p.description, p.status, p."createdAt"
        ORDER by "scoreAvg" DESC, "votesCount" DESC, p."createdAt" ASC
        `,
      [req.params.eventId],
    );

    const escapeCsvValue = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const formatPitchStatus = (status: string) =>
      status === "OPEN" ? "Activo" : "Cerrado";

    // Encabezado del CSV.
    const csvHeader = [
      "posicion",
      "pitch",
      "estado",
      "votos",
      "porcentaje",
      "promedio",
      "innovacion",
      "viabilidad",
      "impacto",
      "presentacion",
      "descripcion",
    ].join(",");

    // Filas del CSV.
    const csvRows = result.rows.map((row, index) =>
      [
        index + 1,
        escapeCsvValue(row.pitchName),
        escapeCsvValue(formatPitchStatus(row.pitchStatus)),
        row.votesCount,
        escapeCsvValue(`${(Number(row.scoreAvg) * 20).toFixed(1)}%`),
        row.scoreAvg,
        row.innovationAvg,
        row.viabilityAvg,
        row.impactAvg,
        row.presentationAvg,
        escapeCsvValue(row.pitchDescription),
      ].join(","),
    );

    // Une encabezado y filas en un solo archivo.
    const csv = [csvHeader, ...csvRows].join("\n");

    // Genera un nombre de archivo seguro.
    const eventName = String(eventResult.rows[0].name)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");

    // Fuerza la descarga del archivo.
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${eventName || "event"}-results.csv"`,
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to export event results" });
  }
});

// Devuelve metricas agregadas del evento para el dashboard.
eventRouter.get("/:eventId/stats", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const canManage = await canManageEvent(session.user.id, req.params.eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        SELECT
          NULLIF(
            COUNT(
              DISTINCT COALESCE(NULLIF(v."evaluatorId", ''), NULLIF(v."ipAddress", ''))
            ),
            0
          )::int AS "evaluatorsCount"
        FROM pitch p
        LEFT JOIN vote v ON v."pitchId" = p.id
        WHERE p."eventId" = $1
      `,
      [req.params.eventId],
    );

    return res.json(
      dashboardEventStatsSchema.parse({
        evaluatorsCount: result.rows[0]?.evaluatorsCount ?? null,
      }),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch event stats" });
  }
});

// Variables usadas para construir URLs publicas.
const env = validateServerEnv()

// Devuelve la URL publica del evento para generar QR.
eventRouter.get("/:eventId/qr", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  try {
    const canManage = await canManageEvent(session.user.id, req.params.eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `SELECT
        e.id,
        e.name
      FROM event e
      WHERE e.id = $1
        `,
      [req.params.eventId],
    )

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Event not found" })
    }

    const event = result.rows[0]

    const publicVoteUrl = `${env.FRONTEND_URL}/invitation/${event.id}`;

    return res.json(
      dashboardEventQrSchema.parse(presentEventQr({
        id: event.id,
        name: event.name,
        publicVoteUrl
      }))
    )
  } catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Failed to generate event access URL" })
  }
})
