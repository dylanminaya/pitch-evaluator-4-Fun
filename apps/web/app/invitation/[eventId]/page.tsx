"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { usePublicEventInvitation, usePublicPitch } from "@/hooks/dashboard";
import { useSession } from "@/lib/better-auth/auth-client";
import type { PublicEventInvitation } from "@workspace/shared/api";

const evaluatorEmailStorageKey = "pitch-evaluator-email";
type InvitationPitch = PublicEventInvitation["pitches"][number];
type SortDirection = "asc" | "desc";
type InvitationSortField = "name" | "presentationOrder" | "createdAt";

const invitationSortOptions: Array<{ value: InvitationSortField; label: string }> = [
  { value: "name", label: "Nombre" },
  { value: "presentationOrder", label: "Orden presentacion" },
  { value: "createdAt", label: "Fecha/hora" },
];

export default function EventInvitationPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = params.eventId;
  const { data: invitation, isLoading, error } = usePublicEventInvitation(eventId);
  const { data: sessionData, isPending: isLoadingSession } = useSession();
  const [emailInput, setEmailInput] = useState("");
  const [evaluatorEmail, setEvaluatorEmail] = useState<string | null>(null);
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [pitchSearch, setPitchSearch] = useState("");
  const [pitchSortField, setPitchSortField] =
    useState<InvitationSortField>("presentationOrder");
  const [pitchSortDirection, setPitchSortDirection] =
    useState<SortDirection>("asc");
  const sessionUserEmail =
    sessionData?.user && typeof sessionData.user === "object" && "email" in sessionData.user
      ? String(sessionData.user.email ?? "").trim().toLowerCase()
      : null;
  const effectiveEvaluatorEmail = isChangingEmail
    ? null
    : evaluatorEmail || sessionUserEmail;
  const votedPitchIds = new Set(
    (searchParams.get("votedPitchIds") ?? "")
      .split(",")
      .map((pitchId) => pitchId.trim())
      .filter(Boolean),
  );
  const evaluatorEmailQuery = (() => {
    const query = new URLSearchParams();

    if (effectiveEvaluatorEmail) {
      query.set("evaluatorEmail", effectiveEvaluatorEmail);
    }

    if (votedPitchIds.size > 0) {
      query.set("votedPitchIds", Array.from(votedPitchIds).join(","));
    }

    const queryString = query.toString();
    return queryString ? `?${queryString}` : "";
  })();
  const visiblePitches = useMemo(() => {
    const normalizedSearch = pitchSearch.trim().toLowerCase();

    return (invitation?.pitches ?? [])
      .map((pitch, index) => ({
        pitch,
        presentationOrder: index + 1,
      }))
      .filter(({ pitch }) => {
        if (!normalizedSearch) return true;

        return `${pitch.name} ${pitch.description ?? ""}`
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((left, right) => {
        const directionMultiplier = pitchSortDirection === "asc" ? 1 : -1;
        let comparison = 0;

        if (pitchSortField === "name") {
          comparison = left.pitch.name.localeCompare(right.pitch.name);
        } else if (pitchSortField === "presentationOrder") {
          comparison = left.presentationOrder - right.presentationOrder;
        } else {
          const leftTime = Date.parse(left.pitch.createdAt ?? "");
          const rightTime = Date.parse(right.pitch.createdAt ?? "");
          comparison =
            (Number.isFinite(leftTime) ? leftTime : 0) -
            (Number.isFinite(rightTime) ? rightTime : 0);
        }

        if (comparison === 0) {
          comparison = left.pitch.name.localeCompare(right.pitch.name);
        }

        return comparison * directionMultiplier;
      })
      .map(({ pitch }) => pitch);
  }, [
    invitation?.pitches,
    pitchSearch,
    pitchSortDirection,
    pitchSortField,
  ]);

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
    router.replace(`/invitation/${eventId}?evaluatorEmail=${encodeURIComponent(normalizedEmail)}`);
  }

  function clearEvaluatorEmail() {
    if (!sessionUserEmail) {
      window.localStorage.removeItem(evaluatorEmailStorageKey);
    }

    setEmailInput("");
    setEvaluatorEmail(null);
    setIsChangingEmail(true);
    router.replace(`/invitation/${eventId}`);
  }

  if (isLoading || isLoadingSession) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] text-[#8899aa]">
        Cargando invitacion...
      </main>
    );
  }

  if (error || !invitation) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-[#8899aa]">
        No pudimos cargar la invitacion del evento.
      </main>
    );
  }

  const votingOpen = invitation.status === "OPEN";
  const formattedDate = new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  if (!effectiveEvaluatorEmail) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-4 text-white">
        <form
          onSubmit={handleEmailSubmit}
          className="w-full max-w-md rounded-[24px] border border-[#263550] bg-[#121d30] p-6 shadow-[0_22px_60px_rgba(2,8,23,0.42)]"
        >
          <Image src="/logo.svg" alt="Pitch 4 Fun" width={110} height={46} className="h-11 w-auto" />
          <div className="mt-8">
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
    <main className="min-h-svh bg-[#0d1526] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-[1440px] items-center justify-center">
        <section className="w-full max-w-[920px] overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_20px_60px_rgba(2,8,23,0.42)]">
          <div className="border-b border-[#263550] bg-[linear-gradient(135deg,#1a2640_0%,#0d1526_55%,#121d30_100%)] px-8 py-10">
            <div className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
                <span>PITCH 4 FUN</span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearEvaluatorEmail}
                  className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
                >
                  {effectiveEvaluatorEmail}
                </Button>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
                  >
                    <ArrowLeft className="size-4" />
                    Salir
                  </Button>
                </Link>
              </div>
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-tight text-white">
              {invitation.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a9b3c9]">
              Elige cualquier pitch del evento para ver su detalle y votar.
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <CalendarDays className="size-4 text-[#83ce00]" />
                  <span>Fecha</span>
                </div>
                <p className="mt-2 text-sm font-medium capitalize text-white">{formattedDate}</p>
              </div>
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <MapPin className="size-4 text-[#00f0ff]" />
                  <span>Ubicacion</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">Votacion digital</p>
              </div>
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <Users className="size-4 text-[#83ce00]" />
                  <span>Pitches</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{invitation.pitches.length}</p>
              </div>
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <Clock3 className="size-4 text-[#00f0ff]" />
                  <span>Estado</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">
                  {votingOpen ? "Votacion abierta" : "Votacion cerrada"}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9] md:grid-cols-3">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#83ce00]" />
                Ya votado
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-4 text-[#ffd166]" />
                Disponible para votar ahora
              </span>
              <span className="inline-flex items-center gap-2">
                <Circle className="size-4 text-white" />
                Pendiente de votar
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-[#263550] bg-[#0d1526] p-3 md:flex-row md:items-center">
              <div className="flex min-w-0 items-center gap-2 md:flex-1">
                <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#263550] bg-[#121d30] px-3 text-sm text-[#a9b3c9]">
                  <Search className="size-4 shrink-0 text-[#83ce00]" />
                  <input
                    type="search"
                    value={pitchSearch}
                    onChange={(event) => setPitchSearch(event.target.value)}
                    placeholder="Buscar pitch"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#5f6b82]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPitchSortDirection((current) =>
                      current === "asc" ? "desc" : "asc",
                    )
                  }
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#263550] bg-[#121d30] text-[#ccff00] transition hover:bg-[#1a2640]"
                  aria-label={
                    pitchSortDirection === "asc"
                      ? "Orden ascendente"
                      : "Orden descendente"
                  }
                  title={pitchSortDirection === "asc" ? "Ascendente" : "Descendente"}
                >
                  {pitchSortDirection === "asc" ? (
                    <ArrowUp className="size-4" />
                  ) : (
                    <ArrowDown className="size-4" />
                  )}
                </button>
              </div>
              <select
                value={pitchSortField}
                onChange={(event) =>
                  setPitchSortField(event.target.value as InvitationSortField)
                }
                className="h-11 rounded-full border border-[#2a4a2a] bg-[#0a1a0a] px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ccff00] outline-none"
                aria-label="Campo de ordenacion"
              >
                {invitationSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {invitation.pitches.length === 0 ? (
                <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-6 text-sm text-[#8899aa]">
                  Este evento todavia no tiene pitches publicados.
                </div>
              ) : visiblePitches.length === 0 ? (
                <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-6 text-sm text-[#8899aa]">
                  No hay pitches que coincidan con la busqueda.
                </div>
              ) : (
                visiblePitches.map((pitch) => (
                  <InvitationPitchCard
                    key={pitch.id}
                    pitch={pitch}
                    votingOpen={votingOpen}
                    evaluatorEmail={effectiveEvaluatorEmail}
                    evaluatorEmailQuery={evaluatorEmailQuery}
                    wasVotedInCurrentFlow={votedPitchIds.has(pitch.id)}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function InvitationPitchCard({
  pitch,
  votingOpen,
  evaluatorEmail,
  evaluatorEmailQuery,
  wasVotedInCurrentFlow,
}: {
  pitch: InvitationPitch;
  votingOpen: boolean;
  evaluatorEmail: string;
  evaluatorEmailQuery: string;
  wasVotedInCurrentFlow: boolean;
}) {
  const { data: publicPitch } = usePublicPitch(pitch.id, evaluatorEmail);
  const currentEventIsOpen = publicPitch ? publicPitch.eventStatus === "OPEN" : votingOpen;
  const currentPitchIsOpen = publicPitch ? publicPitch.pitchStatus === "OPEN" : pitch.status === "OPEN";
  const canOpenPitch = currentEventIsOpen && currentPitchIsOpen;
  const isVoted = wasVotedInCurrentFlow || Boolean(publicPitch?.hasVoted);
  const statusLabel = isVoted
    ? "Ya votado"
    : canOpenPitch
      ? "Disponible para votar ahora"
      : "Pendiente de votar";
  const StatusIcon = isVoted ? CheckCircle2 : canOpenPitch ? Clock3 : Circle;
  const statusClass = isVoted
    ? "border-[#2f5f24] bg-[#112714] text-[#a7ea2e]"
    : canOpenPitch
      ? "border-[#6b5522] bg-[#2a230d] text-[#ffd166]"
      : "border-white/30 bg-white/10 text-white";
  const canViewPitch = canOpenPitch;

  return (
    <article className="rounded-2xl border border-[#263550] bg-[#0d1526] p-5">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase italic tracking-[0.18em] ${statusClass}`}
      >
        <StatusIcon className="size-4" />
        {statusLabel}
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">{pitch.name}</h2>
      <p
        className="mt-3 text-sm leading-6 text-[#a9b3c9]"
        style={{
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "normal",
        }}
      >
        {pitch.description}
      </p>
      <div className="mt-5">
        <Link href={canViewPitch ? `/vote/${pitch.id}${evaluatorEmailQuery}` : "#"} aria-disabled={!canViewPitch}>
          <Button
            className="h-11 w-full rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
            disabled={!canViewPitch}
          >
            {canOpenPitch ? (isVoted ? "Ver voto" : "Votar ahora") : "Pitch cerrado"}
          </Button>
        </Link>
      </div>
    </article>
  );
}
