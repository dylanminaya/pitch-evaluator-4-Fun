// Normaliza la entidad pitch para listados del dashboard.
export const presentPitch = (pitch: {
  id: string;
  eventId: string;
  name: string;
  description: string;
  status: "OPEN" | "CLOSED";
  color: string;
  logoUrl?: string | null;
  presentationUrl?: string | null;
  presentationFileName?: string | null;
  createdAt?: Date | string;
}) => ({
  id: pitch.id,
  eventId: pitch.eventId,
  name: pitch.name,
  description: pitch.description,
  status: pitch.status,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  presentationUrl: pitch.presentationUrl ?? null,
  presentationFileName: pitch.presentationFileName ?? null,
  createdAt: pitch.createdAt instanceof Date ? pitch.createdAt.toISOString() : (pitch.createdAt ?? null),
});

// Forma publica del pitch para la pantalla de voto.
export const presentPublicPitch = (pitch: {
  id: string;
  eventId: string;
  name: string;
  description: string;
  pitchStatus: "OPEN" | "CLOSED";
  color: string;
  logoUrl?: string | null;
  presentationUrl?: string | null;
  presentationFileName?: string | null;
  eventStatus: "OPEN" | "CLOSED";
  hasVoted?: boolean;
  currentVote?: unknown;
}) => ({
  id: pitch.id,
  eventId: pitch.eventId,
  name: pitch.name,
  description: pitch.description,
  pitchStatus: pitch.pitchStatus,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  presentationUrl: pitch.presentationUrl ?? null,
  presentationFileName: pitch.presentationFileName ?? null,
  eventStatus: pitch.eventStatus,
  hasVoted: pitch.hasVoted ?? false,
  currentVote: pitch.currentVote ?? null,
});

// Resumen detallado del pitch con promedios y conteos.
export const presentPitchDetail = (pitch: {
  id: string;
  eventId: string;
  name: string;
  description: string;
  color: string;
  logoUrl?: string | null;
  presentationUrl?: string | null;
  presentationFileName?: string | null;
  votesCount: number | string;
  innovationAvg: number | string;
  viabilityAvg: number | string;
  impactAvg: number | string;
  presentationAvg: number | string;
}) => ({
  id: pitch.id,
  eventId: pitch.eventId,
  name: pitch.name,
  description: pitch.description,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  presentationUrl: pitch.presentationUrl ?? null,
  presentationFileName: pitch.presentationFileName ?? null,
  // Postgres devuelve numeric/bigint como string.
  votesCount: Number(pitch.votesCount),
  innovationAvg: Number(pitch.innovationAvg),
  viabilityAvg: Number(pitch.viabilityAvg),
  impactAvg: Number(pitch.impactAvg),
  presentationAvg: Number(pitch.presentationAvg),
});

// Normaliza un comentario individual.
export const presentPitchComment = (comment: {
  id: string;
  comment: string;
  createdAt: Date | string;
}) => ({
  id: comment.id,
  comment: comment.comment,
  createdAt: comment.createdAt instanceof Date ? comment.createdAt.toISOString() : comment.createdAt,
});

