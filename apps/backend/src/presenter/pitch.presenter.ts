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

// Forma pública del pitch para la pantalla de voto.
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
  status: "OPEN" | "CLOSED";
  color: string;
  logoUrl?: string | null;
  presentationUrl?: string | null;
  presentationFileName?: string | null;
  createdAt?: Date | string | null;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
  scoreAvg: number;
  criteriaAverages?: Array<{
    id: string;
    label: string;
    weight: number;
    avg: number;
  }> | null;
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
  votesCount: Number(pitch.votesCount),
  innovationAvg: Number(pitch.innovationAvg),
  viabilityAvg: Number(pitch.viabilityAvg),
  impactAvg: Number(pitch.impactAvg),
  presentationAvg: Number(pitch.presentationAvg),
  scoreAvg: Number(pitch.scoreAvg),
  criteriaAverages: (pitch.criteriaAverages ?? []).map((criterion) => ({
    id: criterion.id,
    label: criterion.label,
    weight: Number(criterion.weight),
    avg: Number(criterion.avg),
  })),
});

// Normaliza un comentario individual.
export const presentPitchComment = (comment: {
  id: string;
  comment: string;
  commentType?: "OPINION" | "ACTIVADOR" | null;
  createdAt: Date | string;
}) => ({
  id: comment.id,
  comment: comment.comment,
  commentType: comment.commentType ?? "OPINION",
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
    commentType?: "OPINION" | "ACTIVADOR" | null;
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
