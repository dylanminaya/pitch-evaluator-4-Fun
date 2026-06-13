"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageSquare,
  Pencil,
  Vote,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { usePitchComments, usePitches, useRanking } from "@/hooks/dashboard";
import type { CriterionAverage } from "@workspace/shared/api";

const defaultCriteriaAverages: CriterionAverage[] = [
  { id: "innovation", label: "Innovación", weight: 25, avg: 0 },
  { id: "viability", label: "Viabilidad", weight: 25, avg: 0 },
  { id: "impact", label: "Impacto", weight: 25, avg: 0 },
  { id: "presentation", label: "Presentación", weight: 25, avg: 0 },
];

function formatDate(value: string | null) {
  if (!value) return "Fecha no disponible";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(parsed);
}

function getCommentTypeLabel(type: "OPINION" | "ACTIVADOR") {
  return type === "ACTIVADOR" ? "Activador" : "Opinión";
}

export default function PitchDetailPage() {
  const params = useParams<{ eventId: string; pitchId: string }>();
  const eventId = params.eventId;
  const pitchId = params.pitchId;
  const [page, setPage] = useState(1);
  const { data: pitches = [], isLoading: arePitchesLoading, error: pitchesError } = usePitches(eventId);
  const { data: ranking = [], isLoading: isRankingLoading } = useRanking(eventId);
  const {
    data: commentsData,
    isLoading: areCommentsLoading,
    isFetching: areCommentsFetching,
    error: commentsError,
  } = usePitchComments(pitchId, page);
  const pitch = pitches.find((item) => item.id === pitchId);
  const rankingPitch = ranking.find((item) => item.id === pitchId);
  const criteriaAverages = rankingPitch?.criteriaAverages ?? defaultCriteriaAverages.map((criterion) => ({
    ...criterion,
    avg:
      criterion.id === "innovation"
        ? (rankingPitch?.innovationAvg ?? 0)
        : criterion.id === "viability"
          ? (rankingPitch?.viabilityAvg ?? 0)
          : criterion.id === "impact"
            ? (rankingPitch?.impactAvg ?? 0)
            : (rankingPitch?.presentationAvg ?? 0),
  }));

  if (arePitchesLoading || isRankingLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] text-[#a9b3c9]">
        Cargando información del pitch...
      </main>
    );
  }

  if (pitchesError || !pitch) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-[#a9b3c9]">
        No pudimos cargar la información de este pitch.
      </main>
    );
  }

  const comments = commentsData?.comments ?? [];
  const totalPages = commentsData?.totalPages ?? 0;

  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="flex flex-col gap-5 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard?eventId=${eventId}&pitchId=${pitchId}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8899aa] transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              <span>Volver al dashboard</span>
            </Link>
            <div className="hidden h-8 w-px bg-[#263550] md:block" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Información del pitch
              </span>
              <span className="text-sm text-[#a9b3c9]">
                Características, resultados y comentarios del proyecto.
              </span>
            </div>
          </div>

          <Link href={`/events/${eventId}/pitches/${pitchId}/edit`}>
            <Button className="rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]">
              <Pencil className="size-4" />
              Editar pitch
            </Button>
          </Link>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-6">
            <section className="overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="h-2" style={{ backgroundColor: pitch.color }} />
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    {pitch.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pitch.logoUrl}
                        alt={`Logo de ${pitch.name}`}
                        className="size-16 rounded-2xl border border-[#263550] bg-white object-contain p-2"
                      />
                    ) : (
                      <div
                        className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black text-white"
                        style={{ backgroundColor: pitch.color }}
                      >
                        {pitch.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                            pitch.status === "OPEN"
                              ? "bg-[#13210a] text-[#83ce00]"
                              : "bg-[#2a1018] text-[#ff8cab]"
                          }`}
                        >
                          {pitch.status === "OPEN" ? "Activado" : "Cerrado"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[#8899aa]">
                          <CalendarDays className="size-3.5" />
                          {formatDate(pitch.createdAt)}
                        </span>
                      </div>
                      <h1 className="mt-3 break-words text-3xl font-black tracking-tight md:text-4xl">
                        {pitch.name}
                      </h1>
                    </div>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-[#263550] bg-[#0d1526] px-5 py-4 text-center">
                    <p className="text-3xl font-black text-[#ccff00]">
                      {(rankingPitch?.scoreAvg ?? 0).toFixed(2)}
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8899aa]">
                      Puntuacion total
                    </p>
                  </div>
                </div>

                <div className="mt-7 border-t border-[#263550] pt-6">
                  <p className="text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                    Descripción
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#c4ccdc]">
                    {pitch.description}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)] md:p-8">
              <div className="flex flex-col gap-2 border-b border-[#263550] pb-5">
                <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                  Características y evaluación
                </p>
                <p className="text-sm text-[#a9b3c9]">
                  Promedio recibido por cada criterio configurado en el evento.
                </p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {criteriaAverages.map((criterion) => (
                  <div key={criterion.id} className="rounded-2xl border border-[#263550] bg-[#0d1526] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-white">{criterion.label}</p>
                      <span className="rounded-full bg-[#1a2640] px-2.5 py-1 text-[10px] font-bold text-[#8899aa]">
                        {criterion.weight}%
                      </span>
                    </div>
                    <p className="mt-5 text-3xl font-black text-[#ccff00]">{criterion.avg.toFixed(2)}</p>
                    <p className="mt-1 text-xs text-[#8899aa]">Promedio de 5 puntos</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)] md:p-8">
              <div className="flex flex-col gap-3 border-b border-[#263550] pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                    Comentarios
                  </p>
                  <p className="mt-2 text-sm text-[#a9b3c9]">
                    {commentsData ? `${commentsData.total} comentarios recibidos` : "Cargando comentarios..."}
                  </p>
                </div>
                {totalPages > 0 ? (
                  <p className="text-xs font-semibold text-[#8899aa]">
                    Página {page} de {totalPages}
                  </p>
                ) : null}
              </div>

              <div className={`mt-6 flex flex-col gap-4 ${areCommentsFetching ? "opacity-60" : ""}`}>
                {areCommentsLoading ? (
                  <p className="py-10 text-center text-sm text-[#8899aa]">Cargando comentarios...</p>
                ) : commentsError ? (
                  <p className="py-10 text-center text-sm text-[#ff8cab]">
                    No pudimos cargar los comentarios.
                  </p>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-5 py-10 text-center">
                    <MessageSquare className="size-8 text-[#66738f]" />
                    <p className="mt-3 font-semibold">Aún no hay comentarios</p>
                    <p className="mt-1 text-sm text-[#8899aa]">Los comentarios de los evaluadores aparecerán aquí.</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <article key={comment.id} className="rounded-2xl border border-[#263550] bg-[#0d1526] p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                            comment.commentType === "ACTIVADOR"
                              ? "bg-[#08252a] text-[#00f0ff]"
                              : "bg-[#13210a] text-[#83ce00]"
                          }`}
                        >
                          {getCommentTypeLabel(comment.commentType)}
                        </span>
                        <time className="text-xs text-[#66738f]" dateTime={comment.createdAt}>
                          {formatDate(comment.createdAt)}
                        </time>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#d7dbea]">{comment.comment}</p>
                    </article>
                  ))
                )}
              </div>

              {totalPages > 1 ? (
                <div className="mt-6 flex items-center justify-between border-t border-[#263550] pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1 || areCommentsFetching}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-full border-[#263550] bg-transparent text-white hover:bg-[#0d1526] hover:text-white"
                  >
                    <ChevronLeft className="size-4" />
                    Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page >= totalPages || areCommentsFetching}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-full border-[#263550] bg-transparent text-white hover:bg-[#0d1526] hover:text-white"
                  >
                    Siguiente
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              ) : null}
            </section>
          </div>

          <aside className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                Resumen
              </p>
              <div className="mt-5 grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-[#0d1526] px-4 py-4 ring-1 ring-[#263550]">
                  <span className="inline-flex items-center gap-2 text-sm text-[#a9b3c9]"><Vote className="size-4" /> Votos</span>
                  <strong className="text-xl text-[#ccff00]">{rankingPitch?.votesCount ?? 0}</strong>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#0d1526] px-4 py-4 ring-1 ring-[#263550]">
                  <span className="inline-flex items-center gap-2 text-sm text-[#a9b3c9]"><MessageSquare className="size-4" /> Comentarios</span>
                  <strong className="text-xl text-[#ccff00]">{commentsData?.total ?? 0}</strong>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                <FileText className="size-4 text-[#8899aa]" />
                Presentación
              </div>
              {pitch.presentationUrl ? (
                <div className="mt-5">
                  <p className="break-words text-sm leading-6 text-[#a9b3c9]">
                    {pitch.presentationFileName ?? "Presentación del pitch"}
                  </p>
                  <Link href={pitch.presentationUrl} target="_blank" rel="noreferrer">
                    <Button className="mt-4 w-full rounded-full bg-[#83ce00] font-bold text-[#0d1526] hover:bg-[#a7ea2e]">
                      Abrir presentación
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="mt-5 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-5 text-sm leading-6 text-[#8899aa]">
                  Este pitch no tiene una presentación adjunta.
                </p>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
