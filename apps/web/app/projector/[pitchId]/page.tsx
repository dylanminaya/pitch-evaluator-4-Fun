"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Pause, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { usePublicPitch } from "@/hooks/dashboard";

const MIN_MINUTES = 5;
const DEFAULT_MINUTES = 5;
const MAX_MINUTES = 120;

function clampDuration(value: number) {
  return Math.min(Math.max(value, MIN_MINUTES), MAX_MINUTES);
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
  const searchParams = useSearchParams();
  const pitchId = params.pitchId;
  const initialMinutesFromUrl = Number(searchParams.get("minutes"));
  const initialMinutes = Number.isFinite(initialMinutesFromUrl)
    ? clampDuration(initialMinutesFromUrl)
    : DEFAULT_MINUTES;

  const { data: pitch, isLoading, error } = usePublicPitch(pitchId);
  const [durationMinutes, setDurationMinutes] = useState(initialMinutes);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

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
    setImageFailed(false);
  }, [pitch?.logoUrl]);

  const progress = useMemo(() => {
    const totalSeconds = durationMinutes * 60;

    if (totalSeconds <= 0) {
      return 0;
    }

    return Math.min((timeLeftSeconds / totalSeconds) * 100, 100);
  }, [durationMinutes, timeLeftSeconds]);

  const proxiedImageUrl = useMemo(() => {
    if (!pitch?.logoUrl) {
      return null;
    }

    return `/api/image-proxy?url=${encodeURIComponent(normalizeRemoteImageUrl(pitch.logoUrl))}`;
  }, [pitch?.logoUrl]);

  function applyMinutes(nextMinutes: number) {
    const normalizedMinutes = clampDuration(nextMinutes);
    setDurationMinutes(normalizedMinutes);
    setTimeLeftSeconds(normalizedMinutes * 60);
    setIsRunning(false);
  }

  function handleMinutesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const nextValue = Number(event.target.value);

    if (!Number.isFinite(nextValue)) {
      setDurationMinutes(DEFAULT_MINUTES);
      return;
    }

    setDurationMinutes(clampDuration(nextValue));
  }

  function handleApplyTimer() {
    applyMinutes(durationMinutes);
  }

  function handleResetTimer() {
    setTimeLeftSeconds(durationMinutes * 60);
    setIsRunning(false);
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
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
              return;
            }

            router.push(`/invitation/${pitch.eventId}`);
          }}
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
        </div>
      </div>

      <div className="mx-auto flex min-h-svh w-full max-w-[1700px] flex-col px-4 pb-8 pt-20 md:px-8 md:pb-10 md:pt-28">
        <section className="flex flex-1 flex-col overflow-hidden rounded-[36px] border border-white/10 bg-white/5 shadow-[0_28px_100px_rgba(0,0,0,0.35)]">
          <div className="relative flex min-h-[420px] flex-1 items-center justify-center bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 md:p-10">
            {pitch.logoUrl ? (
              <img
                src={proxiedImageUrl ?? pitch.logoUrl}
                alt={pitch.name}
                className="max-h-[68vh] w-auto max-w-full rounded-[28px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
                onError={() => setImageFailed(true)}
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

              <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-[#aebbd1]">
                El tiempo por defecto es 5 minutos y el minimo permitido tambien es 5.
              </div>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
