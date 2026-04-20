"use client";

import Image from "next/image";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Sparkles, Star } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { usePublicPitch, useSubmitPublicVote } from "@/hooks/dashboard";
import type { EventCriterion } from "@workspace/shared/api";

export default function VotingScreenPage() {
  const params = useParams<{ pitchId: string }>();
  const router = useRouter();
  const pitchId = params.pitchId;
  const { data: pitch, isLoading, error } = usePublicPitch(pitchId);
  const { mutateAsync: submitVote, isPending, isSuccess, error: voteError } =
    useSubmitPublicVote();
  const [comment, setComment] = useState("");
  const [scores, setScores] = useState<Record<string, number>>({});

  const criteria: EventCriterion[] = pitch?.criteria ?? [];
  const hasAlreadyVoted = Boolean(pitch?.hasVoted) || isSuccess;

  function updateScore(key: string, value: number) {
    setScores((current) => ({ ...current, [key]: value }));
  }

  function getRatingLabel(value?: number) {
    if (!value) {
      return "Sin evaluar";
    }

    return `${value}/5`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitVote({
      pitchId,
      criteriaScores: criteria.map((criterion) => ({
        criterionId: criterion.id,
        score: scores[criterion.id] ?? 3,
      })),
      comment: comment.trim() || null,
    });
  }

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] text-[#8899aa]">
        Cargando votacion...
      </main>
    );
  }

  if (error || !pitch) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-[#8899aa]">
        No pudimos cargar este pitch.
      </main>
    );
  }

  if (pitch.eventStatus !== "OPEN" || pitch.pitchStatus !== "OPEN") {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-white">
        <div className="rounded-[24px] border border-[#263550] bg-[#1a2640] px-8 py-10">
          La votacion para este pitch ya esta cerrada.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-[#0d1526] px-4 py-4 text-white md:px-8 md:py-6">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col gap-4">
        <header className="flex flex-col gap-4 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Pitch 4 Fun" width={98} height={42} className="h-10 w-auto" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#263550]">/</span>
                <span className="text-xs font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
                  Voting Screen
                </span>
              </div>
              <span className="text-sm text-[#8899aa]">
                Evalua el pitch y envia tu voto.
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#263550] bg-[#0d1526] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#83ce00]">
            {pitch.name}
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
            <div
              className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]"
              style={{ backgroundColor: `${pitch.color}22` }}
            >
              Proyecto a evaluar
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white">
              {pitch.name}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#a9b3c9]">
              {pitch.description}
            </p>
            <div className="mt-6 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#8899aa]">
              {hasAlreadyVoted
                ? "Este dispositivo ya registro un voto para este pitch."
                : "Tu voto cuenta una sola vez por dispositivo. Toma unos segundos para evaluar de forma honesta cada criterio."}
            </div>
          </aside>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              {criteria.map((criterion) => (
                <section
                  key={criterion.id}
                  className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                      <Sparkles className="size-4 text-[#8899aa]" />
                      {criterion.label}
                    </div>
                    <span className="text-sm text-[#a9b3c9]">
                      {getRatingLabel(scores[criterion.id])}
                    </span>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const selectedScore = scores[criterion.id] ?? 0;
                      const selected = selectedScore >= value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateScore(criterion.id, value)}
                          disabled={hasAlreadyVoted}
                          aria-label={`Calificar ${criterion.label} con ${value} estrellas`}
                          className="rounded-md p-1 transition disabled:cursor-not-allowed"
                        >
                          <Star
                            className={`size-7 ${
                              selected
                                ? "fill-[#a7ea2e] text-[#a7ea2e]"
                                : "fill-transparent text-[#66738f]"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <label
                htmlFor="comment"
                className="text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#8899aa]"
              >
                Comentario opcional
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Que te dirias del equipo o de la solucion?"
                disabled={hasAlreadyVoted}
                className="mt-4 min-h-28 w-full rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3 text-sm text-white outline-none placeholder:text-[#66738f]"
              />
            </section>

            {voteError && (
              <div className="rounded-2xl border border-[#5a2433] bg-[#2a1018] p-3 text-sm text-[#ff8cab]">
                {voteError.message}
              </div>
            )}

            {isSuccess && (
              <div className="rounded-2xl border border-[#263550] bg-[#121d30] p-4 text-sm text-[#83ce00]">
                <div className="inline-flex items-center gap-2">
                  <CheckCircle2 className="size-4" />
                  Ya votaste en este pitch.
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/invitation/${pitch.eventId}`)}
                className="h-12 rounded-full border-[#263550] bg-transparent px-6 text-sm font-bold text-white hover:bg-[#1a2640] hover:text-white"
              >
                Ver pitches
              </Button>
              <Button
                type="submit"
                disabled={isPending || hasAlreadyVoted}
                className="h-12 rounded-full bg-[#83ce00] px-6 text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
              >
                {isPending ? "Enviando..." : hasAlreadyVoted ? "Ya votaste" : "Enviar voto"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
