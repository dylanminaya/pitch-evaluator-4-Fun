import {
  acceptEventOrganizerInvitationSchema,
  createEventOrganizerInvitationSchema,
} from "../schema/event.schema.js";
import { canManageEvent } from "../event.permissions.js";
import { eventRouter } from "./event.api.js";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import { randomUUID } from "node:crypto";
import {
  dashboardEventOrganizerInvitationSchema,
  organizerInvitationDetailSchema,
} from "@workspace/shared/api";
import {
  organizerInvitationListSchema,
  presentOrganizerInvitation,
} from "../../presenter/organizer-invitation.presenter.js";
import {
  eventOrganizerListSchema,
  presentEventOrganizer,
} from "../../presenter/event-organizer.presenter.js";
import { validateServerEnv } from "@workspace/shared/env/server";
import { sendOrganizerInvitationEmail } from "../../email.js";
import { Router } from "express";

// Variables de entorno usadas para construir links y mensajes de error.
const env = validateServerEnv();
export const organizerInvitationRouter: Router = Router();

// Crea una invitacion para otro organizer dentro de un evento.
eventRouter.post("/:eventId/organizer-invitations", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = createEventOrganizerInvitationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid invitation data",
      errors: parsed.error.flatten(),
    });
  }

  const canManage = await canManageEvent(session.user.id, req.params.eventId);

  if (!canManage) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { email, role } = parsed.data;

  try {
    // Verifica que el evento exista antes de crear la invitacion.
    const eventResult = await db.query(
      `
        SELECT id, name
        FROM event
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.eventId],
    );

    if ((eventResult.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const duplicatedPendingInvitation = await db.query(
      `
        SELECT 1
        FROM event_organizer_invitation
        WHERE "eventId" = $1
          AND email = $2
          AND status = 'PENDING'
        LIMIT 1
      `,
      [req.params.eventId, email],
    );

    // Evita tener dos invitaciones pendientes para el mismo correo.
    if ((duplicatedPendingInvitation.rowCount ?? 0) > 0) {
      return res.status(409).json({
        message: "There is already a pending invitation for this email",
      });
    }

    const invitationId = randomUUID();
    const token = randomUUID();

    // Guarda la invitacion y el token que viajara en el correo.
    const result = await db.query(
      `
        INSERT INTO event_organizer_invitation (
          id,
          "eventId",
          email,
          role,
          token,
          status,
          "invitedByUserId",
          "expiresAt",
          "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, NOW() + INTERVAL '7 days', NOW())
        RETURNING
          id,
          "eventId",
          email,
          role,
          status,
          "invitedByUserId",
          "acceptedByUserId",
          "expiresAt",
          "createdAt"
      `,
      [
        invitationId,
        req.params.eventId,
        email,
        role,
        token,
        session.user.id,
      ],
    );

    // Link que abre la pagina publica de aceptacion en el frontend.
    const inviteUrl = `${env.FRONTEND_URL}/organizer-invitations/${token}`;

    try {
      // El correo falla sin romper la creacion de la invitacion.
      await sendOrganizerInvitationEmail({
        to: email,
        eventName: eventResult.rows[0].name,
        inviterEmail: session.user.email,
        inviteUrl,
      });
    } catch (emailError) {
      console.error("Failed to send organizer invitation email", emailError);
    }

    const invitation = dashboardEventOrganizerInvitationSchema.parse(
      presentOrganizerInvitation(result.rows[0]),
    );

    return res.status(201).json(invitation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message:
        env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to create organizer invitation: ${error.message}`
          : "Failed to create organizer invitation",
    });
  }
});

// Lista las invitaciones del evento para la vista de equipo.
eventRouter.get("/:eventId/organizer-invitations", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const canManage = await canManageEvent(session.user.id, req.params.eventId);

  if (!canManage) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const result = await db.query(
      `
        SELECT
          id,
          "eventId",
          email,
          role,
          status,
          "invitedByUserId",
          "acceptedByUserId",
          "expiresAt",
          "createdAt"
        FROM event_organizer_invitation
        WHERE "eventId" = $1
          AND status = 'PENDING'
        ORDER BY "createdAt" DESC
      `,
      [req.params.eventId],
    );

    const invitations = organizerInvitationListSchema.parse(
      result.rows.map(presentOrganizerInvitation),
    );

    return res.json(invitations);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message:
        env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to fetch organizer invitations: ${error.message}`
          : "Failed to fetch organizer invitations",
    });
  }
});

// Cancela una invitacion pendiente del evento.
eventRouter.post(
  "/:eventId/organizer-invitations/:invitationId/cancel",
  async (req, res) => {
    const session = await requireSession(req, res);

    if (!session) {
      return;
    }

    const canManage = await canManageEvent(session.user.id, req.params.eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const result = await db.query(
        `
          UPDATE event_organizer_invitation
          SET status = 'CANCELED'
          WHERE id = $1
            AND "eventId" = $2
            AND status = 'PENDING'
          RETURNING id
        `,
        [req.params.invitationId, req.params.eventId],
      );

      if ((result.rowCount ?? 0) === 0) {
        return res.status(404).json({ message: "Pending invitation not found" });
      }

      return res.status(204).send();
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message:
          env.NODE_ENV === "development" && error instanceof Error
            ? `Failed to cancel organizer invitation: ${error.message}`
            : "Failed to cancel organizer invitation",
      });
    }
  },
);

// Lista el owner y los co-organizers del evento.
eventRouter.get("/:eventId/organizers", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const canManage = await canManageEvent(session.user.id, req.params.eventId);

  if (!canManage) {
    return res.status(403).json({ message: "Forbidden" });
  }

  try {
    const result = await db.query(
      `
        SELECT
          e.id || '-owner' AS id,
          e.id AS "eventId",
          u.id AS "userId",
          u.email,
          u.name,
          'ORGANIZER' AS role,
          NULL::text AS "invitedByUserId",
          e."createdAt"
        FROM event e
        JOIN "user" u ON u.id = e."organizerId"
        WHERE e.id = $1

        UNION ALL

        SELECT
          eo.id,
          eo."eventId",
          eo."userId",
          u.email,
          u.name,
          eo.role,
          eo."invitedByUserId",
          eo."createdAt"
        FROM event_organizer eo
        JOIN "user" u ON u.id = eo."userId"
        WHERE eo."eventId" = $1
        ORDER BY "createdAt" ASC
      `,
      [req.params.eventId],
    );

    const organizers = eventOrganizerListSchema.parse(
      result.rows.map(presentEventOrganizer),
    );

    return res.json(organizers);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message:
        env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to fetch event organizers: ${error.message}`
          : "Failed to fetch event organizers",
    });
  }
});

// Carga una invitacion publica a partir del token del correo.
organizerInvitationRouter.get("/:token", async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT
          oi.id,
          oi."eventId",
          e.name AS "eventName",
          oi.email,
          oi.role,
          oi.status,
          inviter.email AS "invitedByEmail",
          oi."expiresAt"
        FROM event_organizer_invitation oi
        JOIN event e ON e.id = oi."eventId"
        JOIN "user" inviter ON inviter.id = oi."invitedByUserId"
        WHERE oi.token = $1
        LIMIT 1
      `,
      [req.params.token],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Invitation not found" });
    }

    const row = result.rows[0];
    const expiresAt =
      row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);

    // Si ya vencio, actualiza el estado antes de responder.
    if (row.status === "PENDING" && expiresAt.getTime() < Date.now()) {
      await db.query(
        `
          UPDATE event_organizer_invitation
          SET status = 'EXPIRED'
          WHERE id = $1
        `,
        [row.id],
      );

      row.status = "EXPIRED";
    }

    const invitation = organizerInvitationDetailSchema.parse({
      id: row.id,
      eventId: row.eventId,
      eventName: row.eventName,
      email: row.email,
      role: row.role,
      status: row.status,
      invitedByEmail: row.invitedByEmail,
      expiresAt: expiresAt.toISOString(),
    });

    return res.json(invitation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message:
        env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to fetch organizer invitation: ${error.message}`
          : "Failed to fetch organizer invitation",
    });
  }
});

// Convierte una invitacion pendiente en acceso real al evento.
organizerInvitationRouter.post("/accept", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = acceptEventOrganizerInvitationSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid invitation token",
      errors: parsed.error.flatten(),
    });
  }

  // Se usa transaccion porque aqui se escriben varias tablas relacionadas.
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Busca la invitacion exacta usando el token.
    const invitationResult = await client.query(
      `
        SELECT
          oi.id,
          oi."eventId",
          oi.email,
          oi.role,
          oi.status,
          oi."expiresAt"
        FROM event_organizer_invitation oi
        WHERE oi.token = $1
        LIMIT 1
      `,
      [parsed.data.token],
    );

    if ((invitationResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Invitation not found" });
    }

    const invitation = invitationResult.rows[0];
    const expiresAt =
      invitation.expiresAt instanceof Date
        ? invitation.expiresAt
        : new Date(invitation.expiresAt);

    // Solo se puede aceptar una invitacion pendiente.
    if (invitation.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Invitation is no longer pending" });
    }

    if (expiresAt.getTime() < Date.now()) {
      await client.query(
        `
          UPDATE event_organizer_invitation
          SET status = 'EXPIRED'
          WHERE id = $1
        `,
        [invitation.id],
      );
      await client.query("COMMIT");
      return res.status(410).json({ message: "Invitation has expired" });
    }

    // Protege el link: solo el correo invitado puede aceptarlo.
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "This invitation belongs to a different email address",
      });
    }

    const existingMembership = await client.query(
      `
        SELECT 1
        FROM event_organizer
        WHERE "eventId" = $1 AND "userId" = $2
        LIMIT 1
      `,
      [invitation.eventId, session.user.id],
    );

    const ownerMembership = await client.query(
      `
        SELECT 1
        FROM event
        WHERE id = $1 AND "organizerId" = $2
        LIMIT 1
      `,
      [invitation.eventId, session.user.id],
    );

    // Evita duplicar membresia si ya era owner o ya era organizer.
    if ((existingMembership.rowCount ?? 0) === 0 && (ownerMembership.rowCount ?? 0) === 0) {
      await client.query(
        `
          INSERT INTO event_organizer (
            id,
            "eventId",
            "userId",
            role,
            "invitedByUserId",
            "createdAt"
          )
          VALUES ($1, $2, $3, $4, NULL, NOW())
        `,
        [randomUUID(), invitation.eventId, session.user.id, invitation.role],
      );
    }

    // Marca la invitacion como aceptada y guarda quien la acepto.
    await client.query(
      `
        UPDATE event_organizer_invitation
        SET
          status = 'ACCEPTED',
          "acceptedByUserId" = $1
        WHERE id = $2
      `,
      [session.user.id, invitation.id],
    );

    await client.query("COMMIT");
    return res.status(200).json({ eventId: invitation.eventId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({
      message:
        env.NODE_ENV === "development" && error instanceof Error
          ? `Failed to accept organizer invitation: ${error.message}`
          : "Failed to accept organizer invitation",
    });
  } finally {
    client.release();
  }
});
