import { db } from "../db.js";

export async function canManageEvent(userId: string, eventId: string) {
  const ownerResult = await db.query(
    `
      SELECT 1
      FROM event
      WHERE id = $1 AND "organizerId" = $2
      LIMIT 1
    `,
    [eventId, userId],
  );

  if ((ownerResult.rowCount ?? 0) > 0) {
    return true;
  }

  const organizerResult = await db.query(
    `
      SELECT 1
      FROM event_organizer
      WHERE "eventId" = $1 AND "userId" = $2
      LIMIT 1
    `,
    [eventId, userId],
  );

  return (organizerResult.rowCount ?? 0) > 0;
}

export async function requireEventAccess(userId: string, eventId: string) {
  const allowed = await canManageEvent(userId, eventId);

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }

  return allowed;
}

export async function getEventIdForPitch(pitchId: string) {
  const result = await db.query(
    `
      SELECT "eventId"
      FROM pitch
      WHERE id = $1
      LIMIT 1
    `,
    [pitchId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return String(result.rows[0].eventId);
}
