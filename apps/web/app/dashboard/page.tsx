"use client";

import { Suspense, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleDot,
  Plus,
  Users,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useSignOut } from "@/hooks/auth";
import {
  useEvents,
  usePitches,
  useRanking,
  usePitchQr,
  useUpdateEventStatus,
} from "@/hooks/dashboard";
//helper
import { exportEvent, exportPitch } from "@/lib/dashboard-api";

function QrDisplay({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="flex h-[118px] w-[118px] items-center justify-center rounded-2xl bg-[#22222f] text-xs text-[#55556a]">
        Sin pitch
      </div>
    );
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=150x150&margin=4`;

  return (
    <div className="rounded-2xl bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrImageUrl} alt="QR de votacion" width={118} height={118} />
    </div>
  );
}

function DashboardPageContent() {
  const searchParams = useSearchParams();
  const { mutate: logout, isPending } = useSignOut();
  const { mutateAsync: mutateEventStatus, isPending: isUpdatingEventStatus } =
    useUpdateEventStatus();

  //query
  const {data: events = [] } = useEvents();
  const requestedEventId = searchParams.get("eventId");
  const requestedPitchId = searchParams.get("pitchId");
  const selectedEvent = useMemo(() => {
    if (!events.length) return undefined;

    return events.find((event) => event.id === requestedEventId) ?? events[0];
  }, [events, requestedEventId]);
  const selectedEventId = selectedEvent?.id;

  const {data: pitches = [] } = usePitches(selectedEventId);//trae pitches del eventos
  const selectedPitch = useMemo(() => {
    if (!pitches.length) return undefined;

    return pitches.find((pitch) => pitch.id === requestedPitchId) ?? pitches[0];
  }, [pitches, requestedPitchId]);
  const selectedPitchId = selectedPitch?.id;

  const { data: rankingData = [] } = useRanking(selectedEventId);
  const { data: qrData } = usePitchQr(selectedPitchId);

  const selectedPitchVotes = rankingData.find(item => item.id === selectedPitchId)?.votesCount ?? 0;
  const eventIsOpen = selectedEvent?.status === "OPEN";

  async function handleToggleEventStatus() {
    if (!selectedEventId || !selectedEvent) return;

    await mutateEventStatus({
      eventId: selectedEventId,
      status: eventIsOpen ? "CLOSED" : "OPEN",
    });
  }

  async function handlerExportEvent() {
    if(!selectedEventId) return;

    const blob = await exportEvent(selectedEventId);//pide el archivo
    const url = URL.createObjectURL(blob);//convierte el archivo en una url
    const link = document.createElement("a");//crear el link
    link.href = url;//apunta al archivo
    link.download = "event-results.csv";//nombre del archivo
    link.click();//simula un click, se descarga
    URL.revokeObjectURL(url)//limpiar memoria
  }

  async function handlerExportPitch() {
    if (!selectedPitchId) return;

    const blob = await exportPitch(selectedPitchId);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pitch-results.csv";
    link.click();
    URL.revokeObjectURL(url)
  }

  //arreglo de objetos, representa una tarjeta de estadística en pantalla
  const stats = [
    {
      label: "Pitches activos",
      value: String(pitches.length),
      accent: "text-white",
    },
    {
      label: "Votos recibidos",
      value: String(
        rankingData.reduce(
          (sum: number, item: { votesCount: number }) => sum + item.votesCount,//suma todos los votos
          0,
        ),
      ),
      accent: "text-lime-300",
    },
    {
      label: "Puntuacion media",
      value:
        rankingData.length > 0
          ? (
              rankingData.reduce(
                (sum: number, item: { scoreAvg: number }) => sum + item.scoreAvg,
                0,
              ) / rankingData.length
            ).toFixed(1)//deja un decimal
          : "0.0",
      accent: "text-cyan-400",
    },
    {
      label: "Evaluadores",
      value: "N/D",//no disponible
      accent: "text-fuchsia-400",
    },
  ];

  const shellClass =
    "rounded-[20px] border border-[#263550] bg-[#121d30] shadow-[0_22px_60px_rgba(2,8,23,0.42)]";
  const panelClass =
    "rounded-2xl border border-[#263550] bg-[#1a2640] shadow-[0_18px_45px_rgba(2,8,23,0.35)]";
  const eyebrowClass =
    "text-[10px] font-bold uppercase italic tracking-[0.32em] text-[#83ce00]";
  
  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
        <header className={`${shellClass} flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8`}>
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Pitch 4 Fun" width={98} height={42} className="h-10 w-auto" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#263550]">/</span>
                <span className="text-xs font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
                  Organizer Dashboard
                </span>
              </div>
              <span className="text-sm text-[#8899aa]">
                {selectedEvent?.name ?? "Sin eventos"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/events">
              <Button
                variant="outline"
                className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
              >
                <ArrowLeft className="size-4" />
                Volver a eventos
              </Button>
            </Link>

            <Link href={selectedEventId ? `/events/${selectedEventId}/team` : "#"}>
              <Button
                variant="outline"
                disabled={!selectedEventId}
                className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
              >
                <Users className="size-4" />
                Equipo
              </Button>
            </Link>
            <div
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                eventIsOpen
                  ? "border-[#263550] bg-[#0d1526] text-[#83ce00]"
                  : "border-[#263550] bg-[#0d1526] text-[#8899aa]"
              }`}
            >
              <CircleDot className="size-3 fill-current" />
              {eventIsOpen ? "En vivo" : "Cerrado"}
            </div>

            <Button
              type="button"
              onClick={handleToggleEventStatus}
              disabled={!selectedEventId || isUpdatingEventStatus}
              className={`rounded-full px-5 text-sm font-bold italic ${
                eventIsOpen
                  ? "bg-[#1a2640] text-[#83ce00] hover:bg-[#22314f]"
                  : "bg-[#83ce00] text-[#0d1526] hover:bg-[#a7ea2e]"
              }`}
            >
              {isUpdatingEventStatus
                ? "Actualizando..."
                : eventIsOpen
                  ? "Marcar cerrado"
                  : "Reabrir evento"}
            </Button>

            <Button
              variant="outline"
              className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
              onClick={() => logout()}
              disabled={isPending}
            >
              {isPending ? "Cerrando..." : "Cerrar sesion"}
            </Button>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/*recorre cada elemento de cada arreglo */}
              {stats.map((stat) => ( 
                <article
                  key={stat.label}
                  className={`${panelClass} px-5 py-5`}
                >
                  <p className="text-[10px] font-bold uppercase italic tracking-[0.3em] text-[#8899aa]">
                    {stat.label} {/*mostrar nombre*/}
                  </p>
                  <p className={`mt-3 text-4xl font-extrabold tracking-tight ${stat.accent}`}>
                    {stat.value}{/*mostrar valor*/}
                  </p>
                </article>
              ))}
            </div>

            <section className={`${panelClass} min-w-0 overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[#263550] bg-[#0d1526] px-5 py-4">
                <div>
                  <p className={eyebrowClass}>
                    Ranking en vivo
                  </p>
                  <p className="mt-1 text-sm text-[#a7a8be]">
                    Tabla proyectable para moderacion y jurado.
                  </p>
                </div>
                <div className="rounded-full border border-[#2a4a2a] bg-[#0a1a0a] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#ccff00]">
                  Actualizado
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-[#263550] bg-[#0d1526] text-[10px] uppercase tracking-[0.24em] text-[#8899aa]">
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Proyecto</th>
                      <th className="px-4 py-3 font-medium">Inn</th>
                      <th className="px-4 py-3 font-medium">Via</th>
                      <th className="px-4 py-3 font-medium">Imp</th>
                      <th className="px-4 py-3 font-medium">Pres</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingData.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`text-sm text-[#d7d8e5] last:border-b-0 ${
                          index === 0
                            ? "bg-[linear-gradient(90deg,rgba(131,206,0,0.1),rgba(13,21,38,0.08))]"
                            : "border-b border-[#263550]"
                        }`}
                      >
                        <td className={`px-4 py-4 text-xs font-bold ${index === 0 ? "text-[#83ce00]" : "text-[#8c8da4]"}`}>
                          {String(index + 1).padStart(2, "0")} {/*muestra el numero de posicion */}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                index === 0 ? "bg-[#ccff00]" : "bg-[#53546a]"//resaltar ganador
                              }`} 
                            />
                            {selectedEventId ? (
                              <Link
                                href={`/events/${selectedEventId}/pitches/${item.id}/edit`}
                                className={`${index === 0 ? "font-semibold text-[#f8ffcf]" : "font-semibold"} transition hover:text-[#83ce00]`}
                              >
                                {item.name}
                              </Link>
                            ) : (
                              <span className={index === 0 ? "font-semibold text-[#f8ffcf]" : "font-semibold"}>
                                {item.name}
                              </span>
                            )}
                          </div>
                        </td>{/*muestra las puntuaciones en cada categoria */}
                        <td className="px-4 py-4 text-[#9da0bc]">{item.innovationAvg}</td>
                        <td className="px-4 py-4 text-[#9da0bc]">{item.viabilityAvg}</td>
                        <td className="px-4 py-4 text-[#9da0bc]">{item.impactAvg}</td>
                        <td className="px-4 py-4 text-[#9da0bc]">{item.presentationAvg}</td>
                        <td className="px-4 py-4 text-right font-semibold text-[#ccff00]">
                          {item.scoreAvg} {/*puntaje final */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <section className={`${panelClass} p-6`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={eyebrowClass}>
                    Codigo QR activo
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">{qrData?.name ?? selectedPitch?.name ?? "Sin pitch seleccionado"}</h2>
                </div>
                <Link href={selectedEventId ? `/events/${selectedEventId}/pitches/new` : "#"}>
                  <Button
                    type="button"
                    disabled={!selectedEventId}
                    className="rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                  >
                    <Plus className="size-4" />
                    Nuevo pitch
                  </Button>
                </Link>
              </div>

              <div className="mt-5 flex justify-center">
                <QrDisplay url={qrData?.publicVoteUrl} />
              </div>

              <p className="mt-4 text-center text-xs text-[#8899aa]">
                escanea para abrir el formulario de voto
              </p>

              {qrData?.publicVoteUrl && (
                <div className="mt-4 rounded-2xl border border-[#263550] bg-[#0d1526] p-4">
                  <p className="text-[10px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                    Link de invitacion
                  </p>
                  <p className="mt-3 break-all text-sm leading-6 text-[#a9b3c9]">
                    {qrData.publicVoteUrl}
                  </p>
                  <div className="mt-4">
                    <Link href={qrData.publicVoteUrl} target="_blank" rel="noreferrer">
                      <Button className="rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]">
                        Abrir invitacion
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-[#0d1526] px-4 py-3 ring-1 ring-[#263550]">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-[#ccff00]">{selectedPitchVotes}</p>
                    <p className="text-xs text-[#97a093]">votos recibidos</p>
                  </div>
                  {/*boton descarga los datos del pitch */}
                  <Button className="rounded-full bg-[#83ce00] px-5 text-[#0d1526] hover:bg-[#a7ea2e]"
                    onClick={handlerExportPitch}
                    disabled={!selectedPitchId}//si desactiva si no hay pitch seleccionado
                  >
                    Export pitch
                  </Button>
                </div>

                <div className="mt-4 flex justify-end">
                  <Link
                    href={
                      selectedEventId && selectedPitchId
                        ? `/events/${selectedEventId}/pitches/${selectedPitchId}/edit`
                        : "#"
                    }
                  >
                    <Button
                      variant="outline"
                      disabled={!selectedEventId || !selectedPitchId}
                      className="rounded-full border-[#263550] bg-transparent text-white hover:bg-[#1a2640] hover:text-white"
                    >
                      Editar pitch
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 text-[#7f8099]">
                <button
                  className="rounded-full border border-[#0595f0] p-2 transition hover:bg-[#0d1526] disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={handlerExportEvent}
                  disabled={!selectedEventId}
                >
                  <ArrowUpRight className="size-4" />
                </button>
                <button className="rounded-full border border-[#263550] p-2 transition hover:bg-[#0d1526]">
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-[#0d1526] text-white">
          <div className="mx-auto flex min-h-svh w-full max-w-[1440px] items-center justify-center px-4 py-4 md:px-8 md:py-6">
            <div className="rounded-[20px] border border-[#263550] bg-[#121d30] px-6 py-4 text-sm text-[#8899aa]">
              Cargando dashboard...
            </div>
          </div>
        </main>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
