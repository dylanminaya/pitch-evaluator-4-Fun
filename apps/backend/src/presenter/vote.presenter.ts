// Normaliza la entidad vote para respuestas del dashboard.
export const presentVote = (vote: {
  id: string;
  pitchId: string;
  evaluatorId?: string | null;
  evaluatorEmail?: string | null;
  innovation: number;
  viability: number;
  impact: number;
  presentation: number;
  comment?: string | null;
  createdAt?: Date | string;
}) => ({
  id: vote.id,
  pitchId: vote.pitchId,
  evaluatorId: vote.evaluatorId ?? null,
  evaluatorEmail: vote.evaluatorEmail ?? null,
  innovation: vote.innovation,
  viability: vote.viability,
  impact: vote.impact,
  presentation: vote.presentation,
  comment: vote.comment ?? null,
  createdAt: vote.createdAt ?? null,
});

// Convierte valores agregados del ranking a numeros consistentes.
export const presentPitchRanking = (pitch: {
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
  color: pitch.color,
  logoUrl: pitch.logoUrl ?? null,
  votesCount: Number(pitch.votesCount),
  innovationAvg: Number(pitch.innovationAvg),
  viabilityAvg: Number(pitch.viabilityAvg),
  impactAvg: Number(pitch.impactAvg),
  presentationAvg: Number(pitch.presentationAvg),
  scoreAvg: Number(pitch.scoreAvg),
  criteriaAverages: pitch.criteriaAverages?.map((criterion) => ({
    id: criterion.id,
    label: criterion.label,
    weight: Number(criterion.weight),
    avg: Number(criterion.avg),
  })),
});
