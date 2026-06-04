"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CircleDot,
  Hash,
  MessageSquare,
  Quote,
  Users,
} from "lucide-react";
import {
  useEventStats,
  useEvents,
  usePitches,
  useRanking,
} from "@/hooks/dashboard";
import { getPitchComments } from "@/lib/dashboard-api";

const stopWords = new Set([
  "para",
  "pero",
  "como",
  "esta",
  "este",
  "esto",
  "tiene",
  "debe",
  "deben",
  "proyecto",
  "pitch",
  "idea",
  "bien",
  "muy",
  "mas",
  "con",
  "por",
  "que",
  "del",
  "las",
  "los",
  "una",
  "uno",
  "sus",
]);

type LiveComment = {
  id: string;
  pitchId: string;
  pitchName: string;
  comment: string;
  createdAt: string;
};

function formatTime(value: string | null) {
  if (!value) return "Sin votos";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Sin votos";

  return new Intl.DateTimeFormat("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getTopTriggers(comments: LiveComment[]) {
  const counts = new Map<string, number>();

  for (const item of comments) {
    const words =
      item.comment
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .match(/[a-z0-9]{4,}/g) ?? [];

    for (const word of words) {
      if (stopWords.has(word)) continue;

      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));
}

export default function EventLivePage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { data: events = [] } = useEvents();
  const { data: pitches = [] } = usePitches(eventId);
  const { data: ranking = [] } = useRanking(eventId);
  const { data: eventStats } = useEventStats(eventId);
  const selectedEvent = events.find((event) => event.id === eventId);

  const commentQueries = useQueries({
    queries: pitches.map((pitch) => ({
      queryKey: ["pitch-comments", pitch.id],
      queryFn: () => getPitchComments(pitch.id),
      enabled: Boolean(pitch.id),
      refetchInterval: 5000,
    })),
  });

  const comments = useMemo<LiveComment[]>(() => {
    return commentQueries
      .flatMap((query, index) => {
        const pitch = pitches[index];

        if (!pitch) return [];

        return (query.data ?? [])
          .filter((item) => item.comment.trim().length > 0)
          .map((item) => ({
            id: item.id,
            pitchId: pitch.id,
            pitchName: pitch.name,
            comment: item.comment,
            createdAt: item.createdAt,
          }));
      })
      .sort((left, right) => {
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      });
  }, [commentQueries, pitches]);

  const totalVotes = ranking.reduce((sum, item) => sum + item.votesCount, 0);
  const expectedVotes =
    eventStats?.evaluatorsCount && pitches.length > 0
      ? eventStats.evaluatorsCount * pitches.length
      : 0;
  const participation =
    expectedVotes > 0 ? Math.min(100, (totalVotes / expectedVotes) * 100) : null;
  const topTriggers = getTopTriggers(comments);
  const highlightedComments = comments
    .filter((item) => item.comment.length >= 24)
    .slice(0, 4);
  const trendMaxVotes = Math.max(1, ...ranking.map((item) => item.votesCount));

  const metrics = [
    {
      label: "Votos emitidos",
      value: String(totalVotes),
      icon: Activity,
      accent: "text-[#ccff00]",
    },
    {
      label: "Participacion",
      value: participation === null ? "N/D" : `${participation.toFixed(1)}%`,
      icon: Users,
      accent: "text-[#00f0ff]",
    },
    {
      label: "Comentarios",
      value: String(comments.length),
      icon: MessageSquare,
      accent: "text-[#f0a0ff]",
    },
    {
      label: "Pitches activos",
      value: String(pitches.filter((pitch) => pitch.status === "OPEN").length),
      icon: CircleDot,
      accent: "text-[#f4c400]",
    },
  ];

  const panelClass =
    "rounded-2xl border border-[#263550] bg-[#1a2640] shadow-[0_18px_45px_rgba(2,8,23,0.35)]";
  const eyebrowClass =
    "text-[10px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]";

  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
        <header className="flex flex-col gap-4 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <Link
              href={`/dashboard?eventId=${eventId}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8899aa] transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Volver al dashboard
            </Link>
            <p className="mt-4 text-[10px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]">
              Panel en vivo
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              {selectedEvent?.name ?? "Evento"}
            </h1>
            <p className="mt-2 text-sm text-[#a9b3c9]">
              Informacion para moderar y comentar la votacion mientras sucede.
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#263550] bg-[#0d1526] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#83ce00]">
            <CircleDot className="size-3 fill-current" />
            Actualiza cada 5s
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article key={metric.label} className={`${panelClass} px-5 py-5`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                    {metric.label}
                  </p>
                  <Icon className={`size-4 ${metric.accent}`} />
                </div>
                <p className={`mt-3 text-4xl font-black tracking-tight ${metric.accent}`}>
                  {metric.value}
                </p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <article className={`${panelClass} min-w-0 overflow-hidden`}>
            <div className="border-b border-[#263550] bg-[#0d1526] px-5 py-4">
              <p className={eyebrowClass}>Tendencias</p>
              <p className="mt-1 text-sm text-[#a7a8be]">
                Movimiento actual por cantidad de votos y promedio.
              </p>
            </div>

            <div className="flex flex-col gap-4 p-5">
              {ranking.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#263550] px-4 py-8 text-sm text-[#8899aa]">
                  Las tendencias apareceran cuando existan pitches con votos.
                </p>
              ) : (
                ranking.map((item, index) => {
                  const width = `${Math.max(8, (item.votesCount / trendMaxVotes) * 100)}%`;

                  return (
                    <div key={item.id} className="grid gap-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">
                            {String(index + 1).padStart(2, "0")} · {item.name}
                          </p>
                          <p className="text-xs text-[#8899aa]">
                            {item.votesCount} votos · promedio {item.scoreAvg}
                          </p>
                        </div>
                        <div className="shrink-0 rounded-full border border-[#263550] bg-[#0d1526] px-3 py-1 text-xs font-bold text-[#ccff00]">
                          {item.scoreAvg}
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#263550]">
                        <div className="h-full rounded-full bg-[#83ce00]" style={{ width }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>

          <article className={`${panelClass} min-w-0 p-5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={eyebrowClass}>Voz de sala</p>
                <p className="mt-1 text-sm text-[#a7a8be]">
                  Comentarios, activadores y frases destacadas.
                </p>
              </div>
              <Hash className="size-5 text-[#83ce00]" />
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                Activadores mas mencionados
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {topTriggers.length === 0 ? (
                  <span className="text-sm text-[#8899aa]">Sin menciones todavia.</span>
                ) : (
                  topTriggers.map((trigger) => (
                    <span
                      key={trigger.label}
                      className="rounded-full border border-[#263550] bg-[#0d1526] px-3 py-1 text-xs font-semibold text-[#d7d8e5]"
                    >
                      {trigger.label} · {trigger.count}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                <Quote className="size-4 text-[#f0a0ff]" />
                Opiniones destacadas
              </div>
              <div className="mt-3 flex max-h-[250px] flex-col gap-3 overflow-y-auto pr-1">
                {highlightedComments.length === 0 ? (
                  <p className="text-sm text-[#8899aa]">Sin opiniones destacadas todavia.</p>
                ) : (
                  highlightedComments.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#263550] bg-[#0d1526] p-4">
                      <p className="truncate text-sm font-semibold text-white">{item.pitchName}</p>
                      <p className="mt-2 text-sm leading-6 text-[#c9ccdc]">{item.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </article>
        </section>

        <section className={`${panelClass} min-w-0 p-5`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={eyebrowClass}>Comentarios recibidos</p>
              <p className="mt-1 text-sm text-[#a7a8be]">
                Ultimas opiniones enviadas por los evaluadores.
              </p>
            </div>
            <MessageSquare className="size-5 text-[#f0a0ff]" />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {comments.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#263550] px-4 py-8 text-sm text-[#8899aa]">
                Aun no hay comentarios.
              </p>
            ) : (
              comments.slice(0, 10).map((item) => (
                <article key={item.id} className="rounded-2xl border border-[#263550] bg-[#0d1526] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-[#83ce00]">{item.pitchName}</p>
                    <span className="shrink-0 text-xs text-[#8899aa]">
                      {formatTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#c9ccdc]">{item.comment}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
