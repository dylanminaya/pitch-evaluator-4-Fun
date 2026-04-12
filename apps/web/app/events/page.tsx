"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Trash2,
  Plus,
  Search,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useSignOut } from "@/hooks/auth";
import { useDeleteEvent, useEvents } from "@/hooks/dashboard";

type FilterKey = "all" | "open" | "closed";

const filterLabels: Record<FilterKey, string> = {
  all: "Todo",
  open: "Activos",
  closed: "Cerrados",
};

const accentTones = [
  "from-[#83ce00] to-[#5ba300]",
  "from-[#00f0ff] to-[#0595f0]",
  "from-[#f4c400] to-[#b68900]",
  "from-[#a855f7] to-[#7c3aed]",
];

function formatEventDate(value: string | null) {
  if (!value) return "Fecha pendiente";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return "Fecha pendiente";

  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function EventsPage() {
  const { mutate: logout, isPending: isSigningOut } = useSignOut();
  const { data: events = [], isLoading } = useEvents();
  const { mutateAsync: removeEvent, isPending: isDeleting } = useDeleteEvent();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredEvents = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return events.filter((event) => {
      const matchesFilter =
        filter === "all" ? true : filter === "open" ? event.status === "OPEN" : event.status === "CLOSED";

      const matchesSearch =
        normalizedSearch.length === 0 ||
        event.name.toLowerCase().includes(normalizedSearch) ||
        event.description.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [deferredSearch, events, filter]);

  async function handleDelete(eventId: string, eventName: string) {
    const confirmed = window.confirm(
      `Vas a eliminar "${eventName}". Esta accion no se puede deshacer.`
    );

    if (!confirmed) return;

    await removeEvent(eventId);
  }

  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="flex flex-col gap-5 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#83ce00] text-xs font-black text-[#0d1526] shadow-[0_0_0_4px_rgba(131,206,0,0.12)]">
              P
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black italic tracking-tight">PITCH 4 FUN</span>
                <span className="text-sm text-[#263550]">/</span>
                <span className="text-xs font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
                  Events Management
                </span>
              </div>
              <span className="text-sm text-[#8899aa]">
                Gestiona tus hackathons, demos y competencias desde un solo lugar.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#263550] bg-[#0d1526] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#83ce00]">
              <CircleDot className="size-3 fill-current" />
              Organizer
            </div>
            <Link href="/events/new">
              <Button className="h-10 rounded-full bg-[#83ce00] px-5 text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]">
                <Plus className="size-4" />
                Nuevo evento
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
              onClick={() => logout()}
              disabled={isSigningOut}
            >
              {isSigningOut ? "Cerrando..." : "Cerrar sesion"}
            </Button>
          </div>
        </header>

        <section className="mt-6 flex flex-col gap-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Mis eventos
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
                Elige el evento que quieres operar
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9b3c9]">
                Cada tarjeta te lleva al dashboard del evento para proyectar ranking,
                revisar pitches y activar el QR de votacion.
              </p>
            </div>

            <label className="flex h-11 w-full max-w-sm items-center gap-3 rounded-2xl border border-[#263550] bg-[#121d30] px-4 text-sm text-[#8899aa] shadow-[0_18px_45px_rgba(2,8,23,0.3)]">
              <Search className="size-4 text-[#8899aa]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar evento..."
                className="w-full bg-transparent text-white outline-none placeholder:text-[#66738f]"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            {Object.entries(filterLabels).map(([key, label]) => {
              const active = filter === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key as FilterKey)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-[#83ce00] bg-[#83ce00] text-[#0d1526]"
                      : "border-[#263550] bg-[#121d30] text-[#8899aa]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid gap-5 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-[170px] rounded-3xl border border-[#263550] bg-[#1a2640]"
                />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-3xl border border-[#263550] bg-[#121d30] px-6 py-10 text-center shadow-[0_18px_45px_rgba(2,8,23,0.3)]">
              <p className="text-lg font-semibold text-white">No encontramos eventos</p>
              <p className="mt-2 text-sm text-[#8899aa]">
                Ajusta el filtro o crea un evento nuevo para empezar.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredEvents.map((event, index) => {
                const accent = accentTones[index % accentTones.length];
                const isOpen = event.status === "OPEN";

                return (
                  <article
                    key={event.id}
                    className="overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_18px_45px_rgba(2,8,23,0.35)] transition hover:border-[#3a5678]"
                  >
                    <Link
                      href={`/dashboard?eventId=${event.id}`}
                      className="group block"
                    >
                      <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} />
                      <div className="flex flex-col gap-5 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-xl font-bold tracking-tight text-white">
                              {event.name}
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-[#a9b3c9]">
                              {event.description}
                            </p>
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                              isOpen
                                ? "border border-[#263550] bg-[#0d1526] text-[#83ce00]"
                                : "border border-[#263550] bg-[#0d1526] text-[#8899aa]"
                            }`}
                          >
                            {isOpen ? "Activo" : "Cerrado"}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-[#8899aa]">
                          <div className="inline-flex items-center gap-2">
                            <CalendarDays className="size-4" />
                            <span>{formatEventDate(event.createdAt)}</span>
                          </div>
                          <div className="inline-flex items-center gap-2">
                            <CircleDot className="size-4" />
                            <span>{isOpen ? "Recepcionando votos" : "Sesion cerrada"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
                            Abrir dashboard
                          </span>
                          <div className="inline-flex items-center gap-2 rounded-full border border-[#263550] bg-[#0d1526] px-4 py-2 text-sm font-semibold text-white">
                            Entrar
                            <ArrowUpRight className="size-4" />
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="border-t border-[#263550] bg-[#0d1526] px-6 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-[#8899aa]">
                          Acciones del evento
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full border-[#5a2433] bg-[#23171b] text-[#ff8cab] hover:bg-[#2f1b21] hover:text-[#ff8cab]"
                          disabled={isDeleting}
                          onClick={() => handleDelete(event.id, event.name)}
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
