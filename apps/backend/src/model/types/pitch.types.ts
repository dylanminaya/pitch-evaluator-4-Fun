export type Pitch = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  color: string;
  logoUrl?: string | null;
  createdAt: Date;
};

export type PublicPitch = {
  id: string;
  name: string;
  description: string;
  color: string;
  logoUrl?: string | null;
  eventStatus: "OPEN" | "CLOSED";
};

export type PitchDetail = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
};

export type PitchComment = {
  id: string;
  comment: string;
  createdAt: Date;
};

export type PitchSummaryPayload = {
  pitchId: string;
  pitchName: string;
  commentsCount: number;
  commets: PitchComment[];
  summary: string | null;
  status: "PENDING_AI" |"READY"|"FAILED";
  message: string;
};

export type PitchQrPayload = {
  id: string;
  name: string;
  publicVoteUrl: string;
}

export type PitchExportRow = {
  pitchId: string;
  pitchName: string;
  description: string;
  color: string;
  logoUrl: string | null;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
  scoreAvg: number;
  aiSummary: string;
}

