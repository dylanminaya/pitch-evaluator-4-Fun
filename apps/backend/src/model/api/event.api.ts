import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import { createEventSchema, updateEventStatusSchema } from "../event.schema.js";
import { presentEvent, presentEventQr } from "../../presenter/event.presenter.js";
import { dashboardEventSchema, dashboardEventQrSchema, publicEventInvitationSchema } from "@workspace/shared/api";
import { validateServerEnv } from "@workspace/shared/env/server";

export const eventRouter: Router = Router();

const hasPgErrorCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

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
          p."logoUrl"
        FROM pitch p
        WHERE p."eventId" = $1
        ORDER BY p."createdAt" ASC
        LIMIT 1
      `,
      [req.params.eventId],
    );

    const event = eventResult.rows[0];
    const pitch = pitchResult.rows[0] ?? null;

    return res.json(
      publicEventInvitationSchema.parse({
        id: event.id,
        name: event.name,
        status: event.status,
        targetPitch: pitch
          ? {
              id: pitch.id,
              name: pitch.name,
              description: pitch.description,
              color: pitch.color,
              logoUrl: pitch.logoUrl,
            }
          : null,
      }),
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch public event invitation" });
  }
});

eventRouter.get("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const result = await db.query(
      `
        SELECT id, name, description, status, "createdAt", "organizerId"
        FROM event
        WHERE "organizerId" = $1
        ORDER BY "createdAt" DESC
      `,
      [session.user.id],
    );

    res.json(
      z.array(dashboardEventSchema).parse(result.rows.map(presentEvent)),
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

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
      result = await db.query(
        `
          INSERT INTO event (id, name, description, status, criteria, "createdAt", "organizerId")
          VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), $6)
          RETURNING id, name, description, status, "createdAt", "organizerId"
        `,
        [eventId, name, description, "OPEN", JSON.stringify(criteria), session.user.id],
      );
    } catch (error) {
      // Fallback for databases that still use the old event table without `criteria`.
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

    res.status(201).json(dashboardEventSchema.parse(presentEvent(result.rows[0])));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create event" });
  }
});

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
    const result = await db.query(
      `
        UPDATE event
        SET status = $1
        WHERE id = $2 AND "organizerId" = $3
        RETURNING id, name, description, status, "createdAt", "organizerId"
      `,
      [parsed.data.status, req.params.id, session.user.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.json(dashboardEventSchema.parse(presentEvent(result.rows[0])));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update event status" });
  }
});

eventRouter.delete("/:id", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const result = await db.query(
      `
        DELETE FROM event
        WHERE id = $1 AND "organizerId" = $2
      `,
      [req.params.id, session.user.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete event" });
  }
});

//export total result
eventRouter.get("/:eventId/export", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const eventResult = await db.query(
      `
      SELECT id, name
      FROM event
      WHERE id = $1
        AND "organizerId" = $2
      `,
      [req.params.eventId, session.user.id],
    );

    if (eventResult.rowCount === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const result = await db.query(
      `
      SELECT
        p.id AS pitchId,
        p.name AS pitchName,
        COUNT(v.id)::int AS "cotesCount",
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
        INNER JOIN event e ON e.id = p."eventId"
        LEFT JOIN vote v ON v."pitchId" = p.id
        WHERE p."eventId" = $1
          AND e."organizerId" = $2
        GROUP by p.id, p.name, p."createdAt"
        ORDER by "scoreAvg" DESC, "votesCount" DESC, p."createdAt" ASC
        `,
      [req.params.eventId, session.user.id],
    );

    //crea encabezado del csv
    const csvHeader = [
      "pitchId",
      "pitchName",
      "votesCount",
      "innovationAvg",
      "viabilityAvg",
      "impactAvg",
      "presentationAvg",
      "scoreAvg",
    ].join(",");

    //crea filas de csv
    const csvRows = result.rows.map((row) =>
      [
        row.pitchId,
        `"${String(row.pitchName).replace(/"/g, '""')}"`,
        row.votesCount,
        row.innovationAvg,
        row.viabilityAvg,
        row.impactAvg,
        row.presentationAvg,
        row.scoreAvg,
      ].join(","),
    );

    //unir todo
    const csv = [csvHeader, ...csvRows].join("\n");

    //crear el nombre del archivo
    const eventName = String(eventResult.rows[0].name)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");

    //forzar descarga
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment: filename="${eventName || "event"}-results.csv"`,
    );

    return res.status(200).send(csv);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to export event results" });
  }
});

//qr
const env = validateServerEnv()
eventRouter.get("/:eventId/qr", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  try {
    const result = await db.query(
      `SELECT
        e.id,
        e.name
      FROM event e
      WHERE e.id = $1
        AND e."organizerId" = $2
        `, [req.params.eventId, session.user.id]
    )

    if (result.rowCount === 0) {
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
