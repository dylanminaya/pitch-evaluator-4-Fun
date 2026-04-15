// Normaliza la entidad event para la respuesta del dashboard.
export const presentEvent = (event: {
  id: string;
  name: string;
  description: string;
  status: "OPEN" | "CLOSED";
  createdAt?: Date | string;
  organizerId: string;
}) => ({
  id: event.id,
  name: event.name,
  description: event.description,
  status: event.status,
  createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : (event.createdAt ?? null),
  organizerId: event.organizerId,
});

// Da forma estable a la respuesta usada para generar el QR del evento.
export const presentEventQr = (pitch: {
  id: string;
  name: string;
  publicVoteUrl: string;
}) => ({
  id: pitch.id,
  name: pitch.name,
  publicVoteUrl: pitch.publicVoteUrl,
});
