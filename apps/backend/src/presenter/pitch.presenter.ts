export const presentPitch = (pitch: {
  id: string;
  eventId: string;
  name: string;
  description: string;
  color: string;
  logoUrl?: string | null;
  createdAt?: Date | string;
}) => ({
  id: pitch.id,
  eventId: pitch.eventId,
  name: pitch.name,
  description: pitch.description,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  createdAt: pitch.createdAt instanceof Date ? pitch.createdAt.toISOString() : (pitch.createdAt ?? null),
});

export const presentPublicPitch = (pitch: {
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl?: string | null;
  eventStatus: "OPEN" | "CLOSED";
}) => ({
  id: pitch.id,
  name: pitch.name,
  description: pitch.description,
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  eventStatus: pitch.eventStatus,
});

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

export const presentPitchQr = (pitch: {
  id: string;
  name: string;
  publicVoteUrl: string;
}) => ({
  id: pitch.id,
  name: pitch.name,
  publicVoteUrl: pitch.publicVoteUrl,
});

export const presentPitchComment = (comment: {
  id: string;
  comment: string;
  createdAt: Date | string;
}) => ({
  id: comment.id,
  comment: comment.comment,
  createdAt: comment.createdAt,
});

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
