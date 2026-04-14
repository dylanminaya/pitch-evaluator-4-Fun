"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Plus,
  Settings2,
  // Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { useCreateEvent } from "@/hooks/dashboard";
import type { EventCriterion } from "@workspace/shared/api";

const setupItems = [
  {
    title: "Votacion anonima",
    description: "El publico vota sin exponer su identidad en pantalla.",
  },
  {
    title: "Comentarios",
    description: "Habilita observaciones para enriquecer la evaluacion.",
  },
  {
    title: "Ranking en vivo",
    description: "Muestra resultados y posiciones en tiempo real.",
  },
];

export default function NewEventPage() {
  const router = useRouter();
  const { mutateAsync, isPending, error } = useCreateEvent();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  //
  const [criteria, setCriteria] = useState<EventCriterion[]>([
    { id: "innovation", label: "Innovacion", weight: 25, isDefault: true },
    { id: "viability", label: "Viabilidad", weight: 25, isDefault: true },
    { id: "impact", label: "Impacto", weight: 25, isDefault: true },
    { id: "presentation", label: "Presentacion", weight: 25, isDefault: true },
  ]);

  const totalWeight = useMemo(
    () => criteria.reduce((sum, criterion) => sum + criterion.weight, 0),
    [criteria],
  );

  function handleAddCriterion() {
    setCriteria((current) => [
      ...current,
      {
        id: `criterion-${crypto.randomUUID()}`,
        label: `Criterio ${current.length + 1}`,
        weight: 0,
        isDefault: false,
      },
    ]);
  }

  function handleCriterionLabelChange(id: string, label: string) {
    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === id ? { ...criterion, label } : criterion,
      ),
    );
  }

  function handleCriterionWeightChange(id: string, weight: number) {
    const normalizedWeight = Number.isNaN(weight)
      ? 0
      : Math.min(100, Math.max(0, weight));

    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === id
          ? { ...criterion, weight: normalizedWeight }
          : criterion,
      ),
    );
  }

  function handleRemoveCriterion(id: string) {
    setCriteria((current) => current.filter((criterion) => criterion.id !== id));
  }
  //

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const createdEvent = await mutateAsync({
      name,
      description,
      criteria,
    });

    router.push(`/dashboard?eventId=${createdEvent.id}`);
  }

  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="flex flex-col gap-5 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8899aa] transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              <span>Volver a eventos</span>
            </Link>
            <div className="hidden h-8 w-px bg-[#263550] md:block" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Nuevo evento
              </span>
              <span className="text-sm text-[#a9b3c9]">
                Configura lo esencial y entra directo al dashboard.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/events">
              <Button
                variant="outline"
                className="rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#1a2640] hover:text-white"
              >
                Cancelar
              </Button>
            </Link>
            <Button
              form="new-event-form"
              type="submit"
              className="rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
              disabled={isPending}
            >
              {isPending ? "Creando..." : "Guardar evento"}
            </Button>
          </div>
        </header>

        <section className="mt-6 flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">
              Crear nuevo evento
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9b3c9]">
              Esta pantalla toma como referencia el flujo de `Desktop - Event Creation`
              de `pencil.pen`: formulario principal a la izquierda y resumen de
              criterios/configuracion a la derecha.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <form
              id="new-event-form"
              onSubmit={handleSubmit}
              className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]"
            >
              <div className="flex flex-col gap-2 border-b border-[#263550] pb-5">
                <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                  Informacion del evento
                </p>
                <p className="text-sm text-[#a9b3c9]">
                  Define el nombre y una descripcion clara para identificar el
                  evento dentro del dashboard del organizer. Tambien puedes
                  ajustar el peso de cada criterio de evaluacion.
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-6">
                {error && (
                  <div className="rounded-2xl border border-[#5a2433] bg-[#2a1018] p-3 text-sm text-[#ff8cab]">
                    {error.message}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="event-name"
                    className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]"
                  >
                    Nombre del evento
                  </label>
                  <Input
                    id="event-name"
                    name="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ej. Hackathon LATAM 2026"
                    disabled={isPending}
                    className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f] focus-visible:border-[#0595f0] focus-visible:ring-[#0595f0]/25"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <label
                    htmlFor="event-description"
                    className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]"
                  >
                    Descripcion
                  </label>
                  <textarea
                    id="event-description"
                    name="description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Describe el objetivo del evento, el tipo de participantes y el contexto general."
                    disabled={isPending}
                    className="min-h-36 rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3 text-sm text-white outline-none placeholder:text-[#66738f] focus:border-[#0595f0] focus:ring-4 focus:ring-[#0595f0]/20"
                  />
                </div>

                {/* <div className="rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] p-5">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 size-4 text-[#83ce00]" />
                    <div>
                      <p className="font-semibold text-white">Preview del flujo</p>
                      <p className="mt-2 text-sm leading-6 text-[#a9b3c9]">
                        Al guardar este evento, se creara con estado `OPEN` y te
                        llevaremos directo a su dashboard para continuar con pitches,
                        ranking y QR de votacion.
                      </p>
                    </div>
                  </div>
                </div> */}
              </div>
            </form>

            <aside className="flex flex-col gap-6">
              <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <Target className="size-4 text-[#a855f7]" />
                    <p className="text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#a88cc8]">
                      Criterios de evaluacion
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${totalWeight === 100 ? "text-[#83ce00]" : "text-[#ff8cab]"}`}>
                      Total {totalWeight}%
                    </span>
                    <Button
                      type="button"
                      onClick={handleAddCriterion}
                      className="h-9 rounded-full bg-[#83ce00] px-4 text-xs font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                      disabled={isPending}
                    >
                      <Plus className="size-4" />
                      Agregar
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  {criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <Input
                          value={criterion.label}
                          onChange={(event) =>
                            handleCriterionLabelChange(criterion.id, event.target.value)
                          }
                          disabled={isPending}
                          className="h-10 border-[#263550] bg-[#121d30] text-white"
                        />
                        <span className="text-sm font-bold text-[#83ce00]">
                          {criterion.weight}%
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={criterion.weight}
                          onChange={(event) =>
                            handleCriterionWeightChange(
                              criterion.id,
                              Number(event.target.value),
                            )
                          }
                          disabled={isPending}
                          className="w-full accent-[#83ce00]"
                        />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={criterion.weight}
                          onChange={(event) =>
                            handleCriterionWeightChange(
                              criterion.id,
                              Number(event.target.value || 0),
                            )
                          }
                          disabled={isPending}
                          className="h-11 w-24 rounded-2xl border-[#263550] bg-[#121d30] px-3 text-white"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleRemoveCriterion(criterion.id)}
                          disabled={isPending || criterion.isDefault}
                          className="h-11 rounded-2xl border-[#263550] bg-transparent px-3 text-white hover:bg-[#1a2640] hover:text-white"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-[#8899aa]">
                  Puedes preparar los criterios aqui. Por ahora esta configuracion es visual y no se guarda todavia en la base de datos.
                </p>
              </section>

              <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
                <div className="inline-flex items-center gap-2">
                  <Settings2 className="size-4 text-[#ff2d78]" />
                  <p className="text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#ff7aaa]">
                    Configuracion
                  </p>
                </div>

                <div className="mt-5 flex flex-col gap-4">
                  {setupItems.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-4"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="size-4 text-[#83ce00]" />
                        <p className="font-medium text-white">{item.title}</p>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[#a9b3c9]">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
