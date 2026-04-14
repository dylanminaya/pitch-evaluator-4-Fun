type EventStatus = "OPEN" | "CLOSED"

export type Event = {
    id: string,
    name: string,
    description: string,
    status: EventStatus,
    createdAt: Date,
    organizerId: string
}

export type EventExportRow = {
  pitchId: string;
  pitchName: string;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
  scoreAvg: number;
}
