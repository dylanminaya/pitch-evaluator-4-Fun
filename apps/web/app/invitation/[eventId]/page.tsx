"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { usePublicEventInvitation } from "@/hooks/dashboard";

export default function EventInvitationPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const { data: invitation, isLoading, error } = usePublicEventInvitation(eventId);

  if (isLoading) {
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

  return (
    <main className="min-h-svh bg-[#0d1526] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-[1440px] items-center justify-center">
        <section className="w-full max-w-[920px] overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_20px_60px_rgba(2,8,23,0.42)]">
          <div className="border-b border-[#263550] bg-[linear-gradient(135deg,#1a2640_0%,#0d1526_55%,#121d30_100%)] px-8 py-10">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
              <span>PITCH 4 FUN</span>
            </div>
            <h1 className="mt-6 text-3xl font-black tracking-tight text-white">
              {invitation.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a9b3c9]">
              Entra con este QR y elige cualquier pitch del evento para ver su detalle y votar.
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

            <div className="mt-6 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9]">
              Selecciona el pitch que quieras revisar. Este QR funciona para todo el evento, no para un solo proyecto.
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {invitation.pitches.length === 0 ? (
                <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-6 text-sm text-[#8899aa]">
                  Este evento todavia no tiene pitches publicados.
                </div>
              ) : (
                invitation.pitches.map((pitch) => {
                  const canOpenPitch = votingOpen && pitch.status === "OPEN";

                  return (
                    <article
                      key={pitch.id}
                      className="rounded-2xl border border-[#263550] bg-[#0d1526] p-5"
                    >
                      <div
                        className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]"
                        style={{ backgroundColor: `${pitch.color}22` }}
                      >
                        {pitch.status === "OPEN" ? "Disponible" : "Cerrado"}
                      </div>
                      <h2 className="mt-4 text-xl font-bold text-white">{pitch.name}</h2>
                      <p className="mt-3 text-sm leading-6 text-[#a9b3c9]">{pitch.description}</p>
                      <div className="mt-5">
                        <Link href={canOpenPitch ? `/vote/${pitch.id}` : "#"} aria-disabled={!canOpenPitch}>
                          <Button
                            className="h-11 w-full rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                            disabled={!canOpenPitch}
                          >
                            Ver pitch
                          </Button>
                        </Link>
                      </div>
                    </article>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <Link href="/" className="flex-1">
                <Button
                  variant="outline"
                  className="h-12 w-full rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                >
                  Salir
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
