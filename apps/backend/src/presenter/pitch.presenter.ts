// Normaliza la entidad pitch para listados del dashboard.
export const presentPitch = (pitch: {
  id: string;
  eventId: string;
  name: string;
  description: string;
  status: "OPEN" | "CLOSED";
  color: string;
  logoUrl?: string | null;
  createdAt?: Date | string;
}) => ({
  id: pitch.id,
  eventId: pitch.eventId,
  name: pitch.name,
  description: pitch.description,
  status: pitch.status,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
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
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
}) => ({
  id: pitch.id,
  eventId: pitch.eventId,
  name: pitch.name,
  description: pitch.description,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  votesCount: pitch.votesCount,
  innovationAvg: pitch.innovationAvg,
  viabilityAvg: pitch.viabilityAvg,
  impactAvg: pitch.impactAvg,
  presentationAvg: pitch.presentationAvg,
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

// Agrupa el payload del resumen con la lista de comentarios.
export const presentPitchSummary = (payload: {
  pitchId: string;
  pitchName: string;
  commentsCount: number;
  comments: Array<{
    id: string;
    comment: string;
    createdAt: Date | string;
  }>;
  summary: string | null;
  status: string;
  message: string;
}) => ({
  pitchId: payload.pitchId,
  pitchName: payload.pitchName,
  commentsCount: payload.commentsCount,
  comments: payload.comments.map(presentPitchComment),
  summary: payload.summary,
  status: payload.status,
  message: payload.message,
});
