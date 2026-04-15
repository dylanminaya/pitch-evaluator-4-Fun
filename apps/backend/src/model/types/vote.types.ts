export type Vote = {
  id: string;
  pitchId: string;
  evaluatorId?: string | null;
  ipAddress?: string | null;
  innovation: number;
  viability: number;
  impact: number;
  presentation: number;
  comment?: string | null;
  createdAt: Date;
};


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