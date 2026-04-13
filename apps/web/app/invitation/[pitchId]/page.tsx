"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Users,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { usePublicPitch } from "@/hooks/dashboard";

export default function EventInvitationPage() {
  const params = useParams<{ pitchId: string }>();
  const pitchId = params.pitchId;
  const { data: pitch, isLoading, error } = usePublicPitch(pitchId);

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] text-[#8899aa]">
        Cargando invitacion...
      </main>
    );
  }

  if (error || !pitch) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-[#8899aa]">
        No pudimos cargar la invitacion.
      </main>
    );
  }

  const votingOpen = pitch.eventStatus === "OPEN";

  return (
    <main className="min-h-svh bg-[#0d1526] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-[1440px] items-center justify-center">
        <section className="w-full max-w-[520px] overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_20px_60px_rgba(2,8,23,0.42)]">
          <div className="border-b border-[#263550] bg-[linear-gradient(135deg,#1a2640_0%,#0d1526_55%,#121d30_100%)] px-8 py-10 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
              <span>PITCH 4 FUN</span>
            </div>
          </div>

          <div className="px-8 py-8">
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tight text-white">
                {pitch.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#a9b3c9]">
                {pitch.description}
              </p>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <CalendarDays className="size-4 text-[#83ce00]" />
                  <span>Fecha</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">Evento activo hoy</p>
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
                  <span>Participantes</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">Publico y jurado</p>
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

            <div className="mt-6 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9]">
              Acepta la invitacion para entrar a la pantalla de evaluacion y
              puntuar este pitch en innovacion, viabilidad, impacto y presentacion.
            </div>

            <div className="mt-6 flex gap-3">
              <Link href="/" className="flex-1">
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                >
                  Declinar
                </Button>
              </Link>
              <Link
                href={votingOpen ? `/vote/${pitchId}` : "#"}
                className="flex-1"
                aria-disabled={!votingOpen}
              >
                <Button
                  className="h-12 w-full rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                  disabled={!votingOpen}
                >
                  Aceptar
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
