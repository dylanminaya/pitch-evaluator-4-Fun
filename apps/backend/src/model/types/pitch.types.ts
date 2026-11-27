// Entidad base de pitch en backend.
export type Pitch = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  status: "OPEN" | "CLOSED";
  color: string;
  logoUrl?: string | null;
  presentationUrl?: string | null;
  presentationFileName?: string | null;
  createdAt: Date;
};

// Forma publica del pitch para la pantalla de voto.
export type PublicPitch = {
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
};

// Resumen detallado del pitch dentro del dashboard.
export type PitchDetail = {
  id: string;
  eventId: string;
  name: string;
  description: string;
  color: string;
  logoUrl: string | null;
  presentationUrl: string | null;
  presentationFileName: string | null;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
};

// Comentario individual dejado en un voto.
export type PitchComment = {
  id: string;
  comment: string;
  createdAt: Date;
};

// Datos necesarios para mostrar o generar el QR del pitch.
export type PitchQrPayload = {
  id: string;
  name: string;
  publicVoteUrl: string;
}

// Fila usada al exportar un pitch en CSV.
export type PitchExportRow = {
  pitchId: string;
  pitchName: string;
  description: string;
  color: string;
  logoUrl: string | null;
  presentationUrl: string | null;
  presentationFileName: string | null;
  votesCount: number;
  innovationAvg: number;
  viabilityAvg: number;
  impactAvg: number;
  presentationAvg: number;
  scoreAvg: number;
}
