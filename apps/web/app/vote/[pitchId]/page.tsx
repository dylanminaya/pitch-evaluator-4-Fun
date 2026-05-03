"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Sparkles, Star } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { usePublicPitch, useSubmitPublicVote } from "@/hooks/dashboard";
import { useSession } from "@/lib/better-auth/auth-client";
import type { EventCriterion } from "@workspace/shared/api";

const evaluatorEmailStorageKey = "pitch-evaluator-email";

export default function VotingScreenPage() {
  const params = useParams<{ pitchId: string }>();
  const router = useRouter();
  const pitchId = params.pitchId;
  const [emailInput, setEmailInput] = useState("");
  const [evaluatorEmail, setEvaluatorEmail] = useState<string | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const { data: sessionData, isPending: isLoadingSession } = useSession();
  const sessionUserEmail =
    sessionData?.user && typeof sessionData.user === "object" && "email" in sessionData.user
      ? String(sessionData.user.email ?? "").trim().toLowerCase()
      : null;
  const effectiveEvaluatorEmail = isChangingEmail
    ? null
    : evaluatorEmail || sessionUserEmail;
  const { data: pitch, isLoading, error } = usePublicPitch(pitchId, effectiveEvaluatorEmail);
  const { mutateAsync: submitVote, isPending, isSuccess, error: voteError } =
    useSubmitPublicVote();
  const [commentDraft, setCommentDraft] = useState<string | null>(null);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, number>>({});

  const criteria: EventCriterion[] = useMemo(() => pitch?.criteria ?? [], [pitch?.criteria]);
  const hasAlreadyVoted = Boolean(pitch?.hasVoted);
  const hasSavedVote = hasAlreadyVoted || isSuccess;
  const isVotingClosed = pitch?.eventStatus !== "OPEN" || pitch?.pitchStatus !== "OPEN";

  useEffect(() => {
    if (isLoadingSession) {
      return;
    }

    const emailFromUrl = new URLSearchParams(window.location.search)
      .get("evaluatorEmail")
      ?.trim()
      .toLowerCase();

    if (emailFromUrl) {
      setEmailInput(emailFromUrl);
      setEvaluatorEmail(emailFromUrl);
      setIsChangingEmail(false);
      return;
    }

    if (sessionUserEmail) {
      setEmailInput(sessionUserEmail);
      setEvaluatorEmail(null);
      setIsChangingEmail(false);
      return;
    }

    const savedEmail = window.localStorage.getItem(evaluatorEmailStorageKey);

    if (savedEmail) {
      setEmailInput(savedEmail);
      setEvaluatorEmail(savedEmail);
    }
  }, [isLoadingSession, sessionUserEmail]);

  function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = emailInput.trim().toLowerCase();

    if (!sessionUserEmail) {
      window.localStorage.setItem(evaluatorEmailStorageKey, normalizedEmail);
    }

    setEvaluatorEmail(normalizedEmail);
    setIsChangingEmail(false);
    setCommentDraft(null);
    setScoreDrafts({});
    router.replace(`/vote/${pitchId}?evaluatorEmail=${encodeURIComponent(normalizedEmail)}`);
  }

  function clearEvaluatorEmail() {
    if (!sessionUserEmail) {
      window.localStorage.removeItem(evaluatorEmailStorageKey);
    }

    setEvaluatorEmail(null);
    setEmailInput("");
    setIsChangingEmail(true);
    setCommentDraft(null);
    setScoreDrafts({});
    router.replace(`/vote/${pitchId}`);
  }

  function updateScore(key: string, value: number) {
    setScoreDrafts((current) => ({ ...current, [key]: value }));
  }

  function getSavedScore(criterionId: string) {
    if (!pitch?.currentVote) {
      return undefined;
    }

    const dynamicScore = pitch.currentVote.criteriaScores?.find(
      (score) => score.criterionId === criterionId,
    )?.score;

    if (dynamicScore) {
      return dynamicScore;
    }

    if (criterionId === "innovation") return pitch.currentVote.innovation;
    if (criterionId === "viability") return pitch.currentVote.viability;
    if (criterionId === "impact") return pitch.currentVote.impact;
    if (criterionId === "presentation") return pitch.currentVote.presentation;

    return undefined;
  }

  function getSelectedScore(criterionId: string) {
    return scoreDrafts[criterionId] ?? getSavedScore(criterionId);
  }

  function getRatingLabel(value?: number) {
    if (!value) {
      return "Sin evaluar";
    }

    return `${value}/5`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isVotingClosed) {
      return;
    }

    const normalizedEmail = effectiveEvaluatorEmail?.trim().toLowerCase() ?? "";

    if (!normalizedEmail) {
      return;
    }

    await submitVote({
      pitchId,
      evaluatorEmail: normalizedEmail,
      criteriaScores: criteria.map((criterion) => ({
        criterionId: criterion.id,
        score: getSelectedScore(criterion.id) ?? 3,
      })),
      comment: (commentDraft ?? pitch?.currentVote?.comment ?? "").trim() || null,
    });

    window.localStorage.setItem(evaluatorEmailStorageKey, normalizedEmail);
    setEvaluatorEmail(normalizedEmail);
    setIsChangingEmail(false);
    router.replace(`/vote/${pitchId}?evaluatorEmail=${encodeURIComponent(normalizedEmail)}`);
  }

  if (isLoadingSession && isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] text-[#8899aa]">
        Cargando votacion...
      </main>
    );
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

  if (!effectiveEvaluatorEmail) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-4 text-white">
        <form
          onSubmit={handleEmailSubmit}
          className="w-full max-w-md rounded-[24px] border border-[#263550] bg-[#121d30] p-6 shadow-[0_22px_60px_rgba(2,8,23,0.42)]"
        >
          <Image src="/logo.svg" alt="Pitch 4 Fun" width={110} height={46} className="h-11 w-auto" />
          <div className="mt-7 rounded-2xl border border-[#263550] bg-[#0d1526] p-4">
            <div className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
              {pitch.name}
            </div>
            <p className="mt-2 text-sm leading-6 text-[#a9b3c9]">
              {pitch.pitchStatus === "OPEN" && pitch.eventStatus === "OPEN"
                ? "Escribe tu correo para votar o cargar tu voto anterior."
                : "Este pitch esta cerrado. Escribe tu correo para ver tu voto guardado."}
            </p>
          </div>
          <div className="mt-6">
            <label
              htmlFor="evaluator-email"
              className="text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]"
            >
              Correo electronico
            </label>
            <input
              id="evaluator-email"
              type="email"
              required
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="tu@email.com"
              className="mt-3 h-12 w-full rounded-2xl border border-[#263550] bg-[#0d1526] px-4 text-sm text-white outline-none placeholder:text-[#66738f] focus:border-[#83ce00]"
            />
          </div>
          <Button
            type="submit"
            className="mt-5 h-12 w-full rounded-full bg-[#83ce00] px-6 text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
          >
            Continuar
          </Button>
        </form>
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
                {isVotingClosed
                  ? "La votacion esta cerrada. Tu voto queda en modo lectura."
                  : "Evalua el pitch y envia tu voto."}
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
              {isVotingClosed
                ? "La votacion para este pitch ya esta cerrada. Puedes ver las estrellas y el comentario guardados, pero no modificarlos."
                : hasSavedVote
                  ? "Este correo ya registro un voto para este pitch. Puedes editarlo mientras el pitch siga abierto."
                  : "Tu voto cuenta una sola vez por correo electronico. Toma unos segundos para evaluar de forma honesta cada criterio."}
            </div>
            <button
              type="button"
              onClick={clearEvaluatorEmail}
              className="mt-4 text-xs font-semibold text-[#83ce00] underline-offset-4 hover:underline"
            >
              {effectiveEvaluatorEmail}
            </button>
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
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-[#263550] bg-[#0d1526] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#83ce00]">
                        {criterion.weight}%
                      </span>
                      <span className="text-sm text-[#a9b3c9]">
                        {getRatingLabel(getSelectedScore(criterion.id))}
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((value) => {
                      const selectedScore = getSelectedScore(criterion.id) ?? 0;
                      const selected = selectedScore >= value;

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => updateScore(criterion.id, value)}
                          disabled={isVotingClosed}
                          aria-label={`Calificar ${criterion.label} con ${value} estrellas`}
                          className="rounded-md p-1 transition hover:bg-[#263550] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
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
                value={commentDraft ?? pitch.currentVote?.comment ?? ""}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Que te dirias del equipo o de la solucion?"
                disabled={isVotingClosed}
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
                  Voto guardado. Puedes seguir editandolo mientras el pitch este abierto.
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const query = effectiveEvaluatorEmail
                    ? `?evaluatorEmail=${encodeURIComponent(effectiveEvaluatorEmail)}`
                    : "";

                  router.push(`/invitation/${pitch.eventId}${query}`);
                }}
                className="h-12 rounded-full border-[#263550] bg-transparent px-6 text-sm font-bold text-white hover:bg-[#1a2640] hover:text-white"
              >
                Ver pitches
              </Button>
              <Button
                type="submit"
                disabled={isPending || isVotingClosed}
                className="h-12 rounded-full bg-[#83ce00] px-6 text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
              >
                {isVotingClosed
                  ? "Pitch cerrado"
                  : isPending
                  ? "Guardando..."
                  : hasSavedVote
                    ? "Guardar cambios"
                    : "Enviar voto"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
