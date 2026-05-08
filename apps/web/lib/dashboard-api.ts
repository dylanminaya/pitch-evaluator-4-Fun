import { apiFetch, apiFetchBlob, apiFetchFile, apiFetchVoid } from "./api/client";

import {
  type CreatePublicVote,
  type CreateDashboardEvent,
  type CreateDashboardPitch,
  type UpdateDashboardPitch,
  type DashboardEvent,
  type DashboardEventStats,
  type DashboardPitch,
  type DashboardRankingItem,
  type DashboardPitchDetail,
  type DashboardPitchComment,
  type DashboardVote,
  type DashboardPitchQr,
  type PublicPitch,
  type PublicEventInvitation,
  type DashboardEventOrganizer,
  type CreateEventOrganizerInvitation,
  type DashboardEventOrganizerInvitation,
  type OrganizerInvitationDetail,
} from "@workspace/shared/api";

export type {
  CreatePublicVote,
  CreateDashboardEvent,
  CreateDashboardPitch,
  UpdateDashboardPitch,
  DashboardEvent,
  DashboardEventStats,
  DashboardPitch,
  DashboardRankingItem,
  DashboardPitchDetail,
  DashboardPitchComment,
  DashboardVote,
  DashboardPitchQr,
  PublicPitch,
  PublicEventInvitation,
  DashboardEventOrganizer,
  CreateEventOrganizerInvitation,
  DashboardEventOrganizerInvitation,
  OrganizerInvitationDetail,
};

export function getEvents() {
  return apiFetch<DashboardEvent[]>("/api/event");
}

export function createEvent(data: CreateDashboardEvent) {
  return apiFetch<DashboardEvent>("/api/event", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getEventStats(eventId: string) {
  return apiFetch<DashboardEventStats>(`/api/event/${eventId}/stats`);
}

export function getPitches(eventId: string) {
  return apiFetch<DashboardPitch[]>(`/api/pitch?eventId=${eventId}`);
}

export function createPitch(data: CreateDashboardPitch) {
  return apiFetch<DashboardPitch>("/api/pitch", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePitch(pitchId: string, data: UpdateDashboardPitch) {
  return apiFetch<DashboardPitch>(`/api/pitch/${pitchId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function uploadPitchPresentation(pitchId: string, file: File) {
  return apiFetchFile<DashboardPitch>(`/api/pitch/${pitchId}/presentation`, file);
}

export function updatePitchStatus(
  pitchId: string,
  status: "OPEN" | "CLOSED",
) {
  return apiFetch<DashboardPitch>(`/api/pitch/${pitchId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getRanking(eventId: string) {
  return apiFetch<DashboardRankingItem[]>(
    `/api/vote/ranking?eventId=${eventId}`,
  );
}

export function getPitchDetail(pitchId: string) {
  return apiFetch<DashboardPitchDetail>(`/api/pitch/detail/${pitchId}`);
}

export function getPitchComments(pitchId: string) {
  return apiFetch<DashboardPitchComment[]>(
    `/api/pitch/comments?pitchId=${pitchId}`,
  );
}

export function getVotes(pitchId: string) {
  return apiFetch<DashboardVote[]>(
    `/api/vote?pitchId=${encodeURIComponent(pitchId)}`,
  );
}

export function getPitchQr(pitchId: string) {
  return apiFetch<DashboardPitchQr>(`/api/pitch/${pitchId}/qr`);
}

export function getEventQr(eventId: string) {
  return apiFetch<DashboardPitchQr>(`/api/event/${eventId}/qr`);
}

export function getPublicPitch(pitchId: string, evaluatorEmail?: string) {
  const query = evaluatorEmail
    ? `?evaluatorEmail=${encodeURIComponent(evaluatorEmail)}`
    : "";

  return apiFetch<PublicPitch>(`/api/pitch/public/${pitchId}${query}`);
}

export function getPublicEventInvitation(eventId: string) {
  return apiFetch<PublicEventInvitation>(`/api/event/public/${eventId}`);
}

export function exportEvent(eventId: string) {
  return apiFetchBlob(`/api/event/${eventId}/export`);
}

export function deleteEvent(eventId: string) {
  return apiFetchVoid(`/api/event/${eventId}`, {
    method: "DELETE",
  });
}

export function updateEventStatus(
  eventId: string,
  status: "OPEN" | "CLOSED",
) {
  return apiFetch<DashboardEvent>(`/api/event/${eventId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function exportPitch(pitchId: string) {
  return apiFetchBlob(`/api/pitch/${pitchId}/export`);
}

export function submitPublicVote(data: CreatePublicVote) {
  return apiFetch("/api/vote", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createOrganizerInvitation(
  eventId: string,
  data: CreateEventOrganizerInvitation,
) {
  return apiFetch<DashboardEventOrganizerInvitation>(
    `/api/event/${eventId}/organizer-invitations`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export function getOrganizerInvitations(eventId: string) {
  return apiFetch<DashboardEventOrganizerInvitation[]>(
    `/api/event/${eventId}/organizer-invitations`,
  );
}

export function cancelOrganizerInvitation(
  eventId: string,
  invitationId: string,
) {
  return apiFetchVoid(
    `/api/event/${eventId}/organizer-invitations/${invitationId}/cancel`,
    {
      method: "POST",
    },
  );
}

export function getEventOrganizers(eventId: string) {
  return apiFetch<DashboardEventOrganizer[]>(
    `/api/event/${eventId}/organizers`,
  );
}

export function removeOrganizer(eventId: string, organizerId: string) {
  return apiFetchVoid(`/api/event/${eventId}/organizers/${organizerId}`, {
    method: "DELETE",
  });
}

export function getOrganizerInvitationByToken(token: string) {
  return apiFetch<OrganizerInvitationDetail>(
    `/api/organizer-invitations/${token}`,
  );
}

export function acceptOrganizerInvitation(token: string) {
  return apiFetch<{ eventId: string }>(`/api/organizer-invitations/accept`, {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}





