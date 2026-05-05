"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Lock,
  SlidersHorizontal,
  Unlock,
  X,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { usePublicPitch, useUpdatePitchStatus } from "@/hooks/dashboard";

const MIN_MINUTES = 1;
const DEFAULT_MINUTES = 5;
const MAX_MINUTES = 120;
const MIN_AUTO_CLOSE_DELAY_SECONDS = 0;
const DEFAULT_AUTO_CLOSE_DELAY_SECONDS = 30;
const MAX_AUTO_CLOSE_DELAY_SECONDS = 600;

function clampDuration(value: number) {
  return Math.min(Math.max(value, MIN_MINUTES), MAX_MINUTES);
}

function clampAutoCloseDelay(value: number) {
  return Math.min(
    Math.max(value, MIN_AUTO_CLOSE_DELAY_SECONDS),
    MAX_AUTO_CLOSE_DELAY_SECONDS,
  );
}

function formatTime(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeRemoteImageUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);

    if (url.hostname === "drive.google.com") {
      const filePathMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
      const fileId = filePathMatch?.[1] ?? url.searchParams.get("id");

      if (fileId) {
        return `https://drive.google.com/uc?export=view&id=${fileId}`;
      }
    }

    if (url.hostname.endsWith("dropbox.com")) {
      url.searchParams.set("raw", "1");
      url.searchParams.delete("dl");
      return url.toString();
    }

    if (url.hostname === "github.com" && url.pathname.includes("/blob/")) {
      return url.toString().replace("github.com/", "raw.githubusercontent.com/").replace("/blob/", "/");
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

export default function ProjectorPitchPage() {
  const params = useParams<{ pitchId: string }>();
  const router = useRouter();
  const pitchId = params.pitchId;

  const { data: pitch, isLoading, error } = usePublicPitch(pitchId);
  const { mutateAsync: updatePitchStatus, isPending: isUpdatingPitchStatus } =
    useUpdatePitchStatus();
  const pitchLogoUrl = pitch?.logoUrl ?? null;
  const pitchPresentationFileName = pitch?.presentationFileName ?? null;
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_MINUTES);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(DEFAULT_MINUTES * 60);
  const [autoCloseDelaySeconds, setAutoCloseDelaySeconds] = useState(
    DEFAULT_AUTO_CLOSE_DELAY_SECONDS,
  );
  const [autoCloseCountdownSeconds, setAutoCloseCountdownSeconds] = useState<
    number | null
  >(null);
  const [autoCloseError, setAutoCloseError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const [projectorMode, setProjectorMode] = useState<"presentation" | "image" | null>(null);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slidesCount, setSlidesCount] = useState(1);
  const [presentationError, setPresentationError] = useState<string | null>(null);
  const [isSlideLoading, setIsSlideLoading] = useState(false);
  const hasScheduledAutoCloseRef = useRef(false);
  const autoCloseDelaySecondsRef = useRef(DEFAULT_AUTO_CLOSE_DELAY_SECONDS);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimeLeftSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId);
          setIsRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRunning]);

  useEffect(() => {
    if (
      timeLeftSeconds !== 0 ||
      pitch?.pitchStatus !== "OPEN" ||
      hasScheduledAutoCloseRef.current
    ) {
      return;
    }

    hasScheduledAutoCloseRef.current = true;
    const delaySeconds = autoCloseDelaySecondsRef.current;
    setAutoCloseError(null);
    setAutoCloseCountdownSeconds(delaySeconds);

    async function closePitchAfterDelay() {
      try {
        await updatePitchStatus({ pitchId, status: "CLOSED" });
        setAutoCloseCountdownSeconds(0);
      } catch {
        setAutoCloseError(
          "No pudimos cerrar las votaciones automaticamente. Revisa tu sesion o cierralas manualmente.",
        );
      }
    }

    if (delaySeconds === 0) {
      void closePitchAfterDelay();
      return;
    }

    const countdownIntervalId = window.setInterval(() => {
      setAutoCloseCountdownSeconds((current) => {
        if (current == null || current <= 1) {
          window.clearInterval(countdownIntervalId);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    const closeTimeoutId = window.setTimeout(() => {
      void closePitchAfterDelay();
    }, delaySeconds * 1000);

    return () => {
      window.clearInterval(countdownIntervalId);
      window.clearTimeout(closeTimeoutId);
    };
  }, [
    pitch?.pitchStatus,
    pitchId,
    timeLeftSeconds,
    updatePitchStatus,
  ]);

  const progress = useMemo(() => {
    const totalSeconds = durationMinutes * 60;

    if (totalSeconds <= 0) {
      return 0;
    }

    return Math.min((timeLeftSeconds / totalSeconds) * 100, 100);
  }, [durationMinutes, timeLeftSeconds]);

  const proxiedImageUrl = useMemo(() => {
    if (!pitchLogoUrl) {
      return null;
    }

    return `/api/image-proxy?url=${encodeURIComponent(normalizeRemoteImageUrl(pitchLogoUrl))}`;
  }, [pitchLogoUrl]);

  const presentationBaseUrl = useMemo(() => {
    if (!pitchPresentationFileName) {
      return null;
    }

    const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    const apiBaseUrl =
      configuredApiBaseUrl ||
      (typeof window === "undefined" ? "" : window.location.origin);
    return `${apiBaseUrl}/api/pitch/public/${encodeURIComponent(pitchId)}/presentation`;
  }, [pitchId, pitchPresentationFileName]);

  const currentSlideImageUrl =
    presentationBaseUrl == null
      ? null
      : `${presentationBaseUrl}/page/${currentSlide}.png`;

  const hasPresentation = Boolean(presentationBaseUrl);
  const hasImage = Boolean(pitchLogoUrl);
  const imageFailed = Boolean(pitchLogoUrl && failedImageUrl === pitchLogoUrl);
  const activeProjectorMode =
    projectorMode === "image" && hasImage
      ? "image"
      : projectorMode === "presentation" && hasPresentation
        ? "presentation"
        : hasPresentation
          ? "presentation"
          : "image";
  const isShowingPresentation =
    activeProjectorMode === "presentation" && hasPresentation;

  useEffect(() => {
    if (!presentationBaseUrl) {
      setCurrentSlide(1);
      setSlidesCount(1);
      setPresentationError(null);
      return;
    }

    let isMounted = true;

    async function loadPresentationMeta() {
      try {
        setPresentationError(null);
        const response = await fetch(`${presentationBaseUrl}/meta`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("No pudimos cargar las paginas de la presentacion.");
        }

        const data = (await response.json()) as { pagesCount?: number };
        const nextSlidesCount = Math.max(Number(data.pagesCount ?? 1), 1);

        if (!isMounted) {
          return;
        }

        setSlidesCount(nextSlidesCount);
        setCurrentSlide((current) => Math.min(Math.max(current, 1), nextSlidesCount));
      } catch {
        if (isMounted) {
          setPresentationError("No pudimos preparar las diapositivas de este PowerPoint.");
        }
      }
    }

    loadPresentationMeta();

    return () => {
      isMounted = false;
    };
  }, [presentationBaseUrl]);

  useEffect(() => {
    if (!currentSlideImageUrl) {
      return;
    }

    setIsSlideLoading(true);
  }, [currentSlideImageUrl]);

  function goToPreviousSlide() {
    setCurrentSlide((current) => Math.max(current - 1, 1));
  }

  function goToNextSlide() {
    setCurrentSlide((current) => Math.min(current + 1, slidesCount));
  }

  useEffect(() => {
    if (!isShowingPresentation) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setCurrentSlide((current) => Math.max(current - 1, 1));
      }

      if (
        event.key === "ArrowRight" ||
        event.key === "PageDown" ||
        event.key === " "
      ) {
        event.preventDefault();
        setCurrentSlide((current) => Math.min(current + 1, slidesCount));
      }

      if (event.key === "Home") {
        event.preventDefault();
        setCurrentSlide(1);
      }

      if (event.key === "End") {
        event.preventDefault();
        setCurrentSlide(slidesCount);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isShowingPresentation, slidesCount]);

  function applyMinutes(nextMinutes: number) {
    const normalizedMinutes = clampDuration(nextMinutes);
    setDurationMinutes(normalizedMinutes);
    setTimeLeftSeconds(normalizedMinutes * 60);
    setIsRunning(false);
    setAutoCloseCountdownSeconds(null);
    setAutoCloseError(null);
    hasScheduledAutoCloseRef.current = false;
  }

  function handleMinutesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);

    if (!Number.isFinite(nextValue)) {
      setDurationMinutes(DEFAULT_MINUTES);
      return;
    }

    setDurationMinutes(clampDuration(nextValue));
  }

  function handleAutoCloseDelayChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);

    if (!Number.isFinite(nextValue)) {
      autoCloseDelaySecondsRef.current = DEFAULT_AUTO_CLOSE_DELAY_SECONDS;
      setAutoCloseDelaySeconds(DEFAULT_AUTO_CLOSE_DELAY_SECONDS);
      return;
    }

    const normalizedDelay = clampAutoCloseDelay(Math.round(nextValue));
    autoCloseDelaySecondsRef.current = normalizedDelay;
    setAutoCloseDelaySeconds(normalizedDelay);
  }

  function handleApplyTimer() {
    applyMinutes(durationMinutes);
  }

  function handleResetTimer() {
    setTimeLeftSeconds(durationMinutes * 60);
    setIsRunning(false);
    setAutoCloseCountdownSeconds(null);
    setAutoCloseError(null);
    hasScheduledAutoCloseRef.current = false;
  }

  async function handlePitchStatusChange(status: "OPEN" | "CLOSED") {
    try {
      setAutoCloseError(null);
      await updatePitchStatus({ pitchId, status });
    } catch {
      setAutoCloseError(
        status === "CLOSED"
          ? "No pudimos cerrar las votaciones. Revisa tu sesion e intenta otra vez."
          : "No pudimos abrir las votaciones. Revisa tu sesion e intenta otra vez.",
      );
    }
  }

  async function handleBackToExports() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // If the browser refuses to exit fullscreen here, still return to exports.
    }

    router.push(`/events/${pitch?.eventId}/exports`);
  }

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#050816] text-lg text-[#90a3bf]">
        Cargando pantalla de proyeccion...
      </main>
    );
  }

  if (error || !pitch) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#050816] px-6 text-center text-lg text-[#90a3bf]">
        No pudimos cargar este pitch para proyeccion.
      </main>
    );
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top,#13233d_0%,#09111f_42%,#04070f_100%)] text-white">
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4 md:p-6">
        <Button
          type="button"
          variant="outline"
          onClick={handleBackToExports}
          className="h-11 rounded-full border-white/15 bg-black/35 px-4 text-sm font-semibold text-white backdrop-blur hover:bg-black/50 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Button>

        <div className="rounded-[22px] border border-white/10 bg-black/45 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur md:px-5 md:py-4">
          <p className="text-right text-[10px] font-bold uppercase tracking-[0.28em] text-[#83ce00]">
            Tiempo
          </p>
          <p className="mt-1 text-3xl font-black tracking-[-0.08em] md:text-5xl">
            {formatTime(timeLeftSeconds)}
          </p>
          <div className="mt-3 h-2 w-[120px] overflow-hidden rounded-full bg-white/10 md:w-[180px]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${pitch.color}, #83ce00)`,
              }}
            />
          </div>
          <p className="mt-3 text-right text-[11px] font-bold uppercase tracking-[0.18em] text-[#c2ccdc]">
            {pitch.pitchStatus === "OPEN" ? "Votos abiertos" : "Votos cerrados"}
          </p>
          {autoCloseCountdownSeconds != null && pitch.pitchStatus === "OPEN" && (
            <p className="mt-1 text-right text-xs font-semibold text-[#ffcf6e]">
              Cierre en {autoCloseCountdownSeconds}s
            </p>
          )}
        </div>
      </div>

      {isShowingPresentation && currentSlideImageUrl ? (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black">
          {presentationError ? (
            <div className="mx-6 max-w-xl rounded-[28px] border border-[#5a2433] bg-[#2a1018]/90 px-6 py-5 text-center text-[#ffb7c9]">
              {presentationError}
            </div>
          ) : (
            <>
              {isSlideLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black text-center">
                  <div className="mx-6 max-w-xl rounded-[28px] border border-white/10 bg-white/10 px-6 py-5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#83ce00]">
                      Cargando presentacion
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[#c2ccdc]">
                      Estamos preparando las diapositivas.
                    </p>
                  </div>
                </div>
              )}
              <img
                src={currentSlideImageUrl}
                alt={`Diapositiva ${currentSlide} de ${pitch.name}`}
                className="h-full w-full object-contain"
                onLoad={() => setIsSlideLoading(false)}
                onError={() => {
                  setIsSlideLoading(false);
                  setPresentationError("No pudimos mostrar esta diapositiva del PowerPoint.");
                }}
              />
            </>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />

          <div className="pointer-events-auto absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/70 px-3 py-2 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur">
            <Button
              type="button"
              onClick={goToPreviousSlide}
              disabled={currentSlide <= 1}
              className="h-10 w-10 rounded-full bg-white/10 p-0 text-white hover:bg-white/20 disabled:opacity-35"
              aria-label="Diapositiva anterior"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <span className="min-w-[86px] text-center text-sm font-bold text-white">
              {currentSlide} / {slidesCount}
            </span>
            <Button
              type="button"
              onClick={goToNextSlide}
              disabled={currentSlide >= slidesCount}
              className="h-10 w-10 rounded-full bg-white/10 p-0 text-white hover:bg-white/20 disabled:opacity-35"
              aria-label="Siguiente diapositiva"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex min-h-svh w-full max-w-[1700px] flex-col px-4 pb-8 pt-20 md:px-8 md:pb-10 md:pt-28">
          <section className="flex flex-1 flex-col overflow-hidden rounded-[36px] border border-white/10 bg-white/5 shadow-[0_28px_100px_rgba(0,0,0,0.35)]">
            <div className="relative flex min-h-[420px] flex-1 items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 md:p-10">
              {pitch.logoUrl ? (
                <img
                  src={proxiedImageUrl ?? pitch.logoUrl}
                  alt={pitch.name}
                  className="max-h-[68vh] w-auto max-w-full rounded-[28px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                  onError={() => setFailedImageUrl(pitch.logoUrl)}
                  onLoad={() => setFailedImageUrl(null)}
                />
              ) : (
                <div
                  className="flex h-full min-h-[320px] w-full items-center justify-center rounded-[28px] border border-dashed border-white/15 text-center"
                  style={{ backgroundColor: `${pitch.color}18` }}
                >
                  <div className="px-6">
                    <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#83ce00]">
                      Sin imagen
                    </p>
                    <p className="mt-4 text-2xl font-black tracking-tight text-white md:text-5xl">
                      {pitch.name}
                    </p>
                    <p className="mt-3 text-sm text-[#9cb1cf] md:text-base">
                      Este pitch no tiene una URL de imagen configurada.
                    </p>
                  </div>
                </div>
              )}

              {pitch.logoUrl && imageFailed && (
                <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-[#5a2433] bg-[#2a1018]/90 px-4 py-3 text-sm text-[#ffb7c9] backdrop-blur">
                  No pudimos mostrar esta imagen. Prueba con un enlace directo al archivo o usa una URL publica de imagen.
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-black/20 px-6 py-5 md:px-8 md:py-6">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]">
                Pantalla de proyeccion
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                {pitch.name}
              </h1>
              <p className="mt-4 max-w-5xl text-sm leading-7 text-[#c2ccdc] md:text-lg">
                {pitch.description}
              </p>
            </div>
          </section>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 md:p-6">
        <div className="pointer-events-auto flex flex-col items-center gap-3">
          <Button
            type="button"
            onClick={() => setShowControls((current) => !current)}
            className="h-11 rounded-full bg-black/70 px-4 text-sm font-bold text-white backdrop-blur hover:bg-black/85"
          >
            {showControls ? <X className="size-4" /> : <SlidersHorizontal className="size-4" />}
            {showControls ? "Ocultar controles" : "Mostrar controles"}
          </Button>

          {showControls && (
            <aside className="w-[min(92vw,560px)] rounded-[28px] border border-white/10 bg-black/80 p-5 shadow-[0_28px_100px_rgba(0,0,0,0.45)] backdrop-blur md:p-6">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]">
                Panel del operador
              </p>

              {hasPresentation && hasImage && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    onClick={() => setProjectorMode("presentation")}
                    className={`h-11 rounded-2xl text-sm font-bold ${
                      activeProjectorMode === "presentation"
                        ? "bg-[#83ce00] text-[#07111f] hover:bg-[#a7ea2e]"
                        : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                  >
                    Presentacion
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setProjectorMode("image")}
                    className={`h-11 rounded-2xl text-sm font-bold ${
                      activeProjectorMode === "image"
                        ? "bg-[#83ce00] text-[#07111f] hover:bg-[#a7ea2e]"
                        : "bg-white/10 text-white hover:bg-white/15"
                    }`}
                  >
                    Imagen
                  </Button>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  type="number"
                  min={MIN_MINUTES}
                  max={MAX_MINUTES}
                  step={1}
                  value={durationMinutes}
                  onChange={handleMinutesChange}
                  className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-base text-white"
                />
                <Button
                  type="button"
                  onClick={handleApplyTimer}
                  className="h-12 rounded-2xl bg-[#83ce00] px-5 text-sm font-bold italic text-[#07111f] hover:bg-[#a7ea2e]"
                >
                  Aplicar minutos
                </Button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  type="number"
                  min={MIN_AUTO_CLOSE_DELAY_SECONDS}
                  max={MAX_AUTO_CLOSE_DELAY_SECONDS}
                  step={1}
                  value={autoCloseDelaySeconds}
                  onChange={handleAutoCloseDelayChange}
                  className="h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-base text-white"
                />
                <div className="flex h-12 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-[#c2ccdc]">
                  segundos para cerrar
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => setIsRunning((current) => !current)}
                  disabled={timeLeftSeconds === 0}
                  className="h-12 rounded-2xl bg-white text-sm font-bold text-[#07111f] hover:bg-white/90"
                >
                  {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {isRunning ? "Pausar" : "Iniciar"}
                </Button>
                <Button
                  type="button"
                  onClick={handleResetTimer}
                  variant="outline"
                  className="h-12 rounded-2xl border-white/15 bg-transparent text-sm font-bold text-white hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="size-4" />
                  Reiniciar
                </Button>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={() => handlePitchStatusChange("OPEN")}
                  disabled={pitch.pitchStatus === "OPEN" || isUpdatingPitchStatus}
                  className="h-12 rounded-2xl bg-white/10 text-sm font-bold text-white hover:bg-white/15 disabled:opacity-45"
                >
                  <Unlock className="size-4" />
                  Abrir votos
                </Button>
                <Button
                  type="button"
                  onClick={() => handlePitchStatusChange("CLOSED")}
                  disabled={pitch.pitchStatus === "CLOSED" || isUpdatingPitchStatus}
                  className="h-12 rounded-2xl bg-[#ffcf6e] text-sm font-bold text-[#07111f] hover:bg-[#ffe08f] disabled:opacity-45"
                >
                  <Lock className="size-4" />
                  Cerrar votos
                </Button>
              </div>

              {autoCloseError && (
                <div className="mt-4 rounded-[20px] border border-[#5a2433] bg-[#2a1018]/90 px-4 py-3 text-sm leading-6 text-[#ffb7c9]">
                  {autoCloseError}
                </div>
              )}

              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-[#aebbd1]">
                El cronometro cierra este pitch automaticamente al terminar el tiempo mas la espera configurada.
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
