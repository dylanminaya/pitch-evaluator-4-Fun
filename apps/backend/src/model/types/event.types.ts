type EventStatus = "OPEN" | "CLOSED"

// Entidad base de evento en backend.
export type Event = {
    id: string,
    name: string,
    description: string,
    status: EventStatus,
    createdAt: Date,
    organizerId: string
}

// Fila usada al exportar resultados de un evento.
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
