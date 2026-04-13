import { apiFetch, apiFetchBlob, apiFetchVoid } from "./api/client";
import type {
  CreatePublicVote,
  CreateDashboardEvent,
  CreateDashboardPitch,
  DashboardEvent,
  DashboardPitch,
  DashboardRankingItem,
  DashboardPitchDetail,
  DashboardPitchComment,
  DashboardPitchQr,
  PublicPitch,
} from "@workspace/shared/api";

export type {
  CreatePublicVote,
  CreateDashboardEvent,
  CreateDashboardPitch,
  DashboardEvent,
  DashboardPitch,
  DashboardRankingItem,
  DashboardPitchDetail,
  DashboardPitchComment,
  DashboardPitchQr,
  PublicPitch,
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

export function getPitches(eventId: string) {
  return apiFetch<DashboardPitch[]>(`/api/pitch?eventId=${eventId}`);
}

export function createPitch(data: CreateDashboardPitch) {
  return apiFetch<DashboardPitch>("/api/pitch", {
    method: "POST",
    body: JSON.stringify(data),
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

export function getPitchQr(pitchId: string) {
  return apiFetch<DashboardPitchQr>(`/api/pitch/${pitchId}/qr`);
}

export function getPublicPitch(pitchId: string) {
  return apiFetch<PublicPitch>(`/api/pitch/public/${pitchId}`);
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
