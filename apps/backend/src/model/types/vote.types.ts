// Entidad base de voto en backend.
export type Vote = {
  id: string;
  pitchId: string;
  evaluatorId?: string | null;
  evaluatorEmail?: string | null;
  innovation: number;
  viability: number;
  impact: number;
  presentation: number;
  comment?: string | null;
  createdAt: Date;
};

// Fila agregada usada para construir el ranking de pitches.
export type PitchRanking = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  color: string;
  logoUrl:string | null;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
  scoreAvg: number;
}
