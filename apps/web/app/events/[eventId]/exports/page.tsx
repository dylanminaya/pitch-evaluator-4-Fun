"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileDown,
  Files,
  SquareStack,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { FeedbackPanel } from "@/components/feedback-panel";
import { useEvents, usePitches, useRanking } from "@/hooks/dashboard";
import { exportPitch } from "@/lib/dashboard-api";
import { getFriendlyErrorItems } from "@/lib/user-feedback";
import type { CriterionAverage, EventCriterion } from "@workspace/shared/api";

const defaultCriteria: EventCriterion[] = [
  { id: "innovation", label: "Innovacion", weight: 25, isDefault: true },
  { id: "viability", label: "Viabilidad", weight: 25, isDefault: true },
  { id: "impact", label: "Impacto", weight: 25, isDefault: true },
  { id: "presentation", label: "Presentacion", weight: 25, isDefault: true },
];

function formatPercentage(scoreAvg: number) {
  return `${(scoreAvg * 20).toFixed(1)}%`;
}

function escapeCsvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatPitchStatus(status: string) {
  return status === "OPEN" ? "Activo" : "Cerrado";
}

function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);//crea una URL temporal con `URL.createObjectURL(blob)
  const link = document.createElement("a");//crea un enlace HTML,
  link.href = url;
  link.download = fileName;//asigna el nombre del archivo,
  link.click();
  URL.revokeObjectURL(url);//libera memoria con `URL.revokeObjectURL(url)`
}

export default function EventExportsPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const { data: events = [], isLoading: isLoadingEvents } = useEvents();
  const { data: pitches = [], isLoading: isLoadingPitches } = usePitches(eventId);
  const { data: ranking = [], isLoading: isLoadingRanking } = useRanking(eventId);
  const [selectedPitchIds, setSelectedPitchIds] = useState<string[]>([]);
  const [isExportingPitchId, setIsExportingPitchId] = useState<string | null>(null);
  const [isExportingSelection, setIsExportingSelection] = useState(false);
  const [exportError, setExportError] = useState<Error | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === eventId),
    [eventId, events],
  );

  const selectedCriteria = selectedEvent?.criteria ?? defaultCriteria;
  const pitchStatusById = useMemo(
    () => new Map(pitches.map((pitch) => [pitch.id, pitch.status])),
    [pitches],
  );

  const rankingRows = useMemo(() => {
    function getCriterionAverages(item: {
      criteriaAverages?: CriterionAverage[];
      innovationAvg: number;
      viabilityAvg: number;
      impactAvg: number;
      presentationAvg: number;
    }) {
      if (item.criteriaAverages?.length) {
        return item.criteriaAverages;
      }

      const legacyAverages = new Map([
        ["innovation", item.innovationAvg],
        ["viability", item.viabilityAvg],
        ["impact", item.impactAvg],
        ["presentation", item.presentationAvg],
      ]);

      return selectedCriteria.map((criterion) => ({
        id: criterion.id,
        label: criterion.label,
        weight: criterion.weight,
        avg: legacyAverages.get(criterion.id) ?? 0,
      }));
    }

    return [...ranking]
      .map((item) => ({
        ...item,
        percentage: Number((item.scoreAvg * 20).toFixed(1)),
        pitchStatus: pitchStatusById.get(item.id) ?? "OPEN",
        criterionAverages: getCriterionAverages(item),
      }))
      .sort((left, right) => {
        if (right.percentage !== left.percentage) {
          return right.percentage - left.percentage;
        }

        if (right.votesCount !== left.votesCount) {
          return right.votesCount - left.votesCount;
        }

        return left.name.localeCompare(right.name);
      });
  }, [pitchStatusById, ranking, selectedCriteria]);

  useEffect(() => {
    setSelectedPitchIds((current) =>
      current.filter((pitchId) => rankingRows.some((row) => row.id === pitchId)),
    );
  }, [rankingRows]);

  const allSelected =
    rankingRows.length > 0 && selectedPitchIds.length === rankingRows.length;

  const selectedRows = rankingRows.filter((row) => selectedPitchIds.includes(row.id));

  function togglePitchSelection(pitchId: string) {
    setSelectedPitchIds((current) =>
      current.includes(pitchId)
        ? current.filter((currentPitchId) => currentPitchId !== pitchId)
        : [...current, pitchId],
    );
  }

  function toggleSelectAll() {
    setSelectedPitchIds(allSelected ? [] : rankingRows.map((row) => row.id));
  }

  function buildCombinedCsv(rows: typeof rankingRows) {
    const header = [
      "posicion",
      "pitch",
      "estado",
      "votos",
      "porcentaje",
      "promedio",
      ...selectedCriteria.map((criterion) => `${criterion.label.toLowerCase()}Promedio`),
      "descripcion",
    ];

    const dataRows = rows.map((row, index) => [
      index + 1,
      row.name,
      formatPitchStatus(row.pitchStatus),
      row.votesCount,
      `${row.percentage.toFixed(1)}%`,
      row.scoreAvg,
      ...selectedCriteria.map(
        (criterion) =>
          row.criterionAverages.find((item) => item.id === criterion.id)?.avg ?? 0,
      ),
      row.description,
    ]);

    return [header, ...dataRows]
      .map((csvRow) => csvRow.map((value) => escapeCsvValue(value)).join(","))
      .join("\n");
  }

  async function handleExportPitch(pitchId: string, pitchName: string) {
    try {
      setExportError(null);
      setIsExportingPitchId(pitchId);
      const blob = await exportPitch(pitchId);
      triggerBlobDownload(blob, `${createSlug(pitchName) || "pitch"}-report.csv`);
    } catch (error) {
      setExportError(
        error instanceof Error ? error : new Error("Failed to export pitch"),
      );
    } finally {
      setIsExportingPitchId(null);
    }
  }

  async function handleProjectPitch(pitchId: string) {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Some browsers can reject fullscreen; projection should still open.
    }

    router.push(`/projector/${pitchId}`);
  }

  function handleExportCombined(rows: typeof rankingRows, mode: "selected" | "all") {
    if (rows.length === 0) return;

    try {
      setExportError(null);
      setIsExportingSelection(true);
      const csv = buildCombinedCsv(rows);
      const fileNameBase = createSlug(selectedEvent?.name ?? "event");
      const suffix = mode === "all" ? "all-pitches" : "selected-pitches";
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      triggerBlobDownload(blob, `${fileNameBase}-${suffix}.csv`);
    } catch (error) {
      setExportError(
        error instanceof Error ? error : new Error("Failed to export event data"),
      );
    } finally {
      setIsExportingSelection(false);
    }
  }

  const isLoading = isLoadingEvents || isLoadingPitches || isLoadingRanking;

  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="flex flex-col gap-5 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard?eventId=${eventId}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8899aa] transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              <span>Volver al dashboard</span>
            </Link>
            <div className="hidden h-8 w-px bg-[#263550] md:block" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Centro de exportacion
              </span>
              <span className="text-sm text-[#a9b3c9]">
                Exporta uno, varios o todos los pitches del evento ordenados por porcentaje.
              </span>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#263550] bg-[#0d1526] px-4 py-2 text-sm font-semibold text-white">
            <SquareStack className="size-4 text-[#83ce00]" />
            {selectedEvent?.name ?? "Evento"}
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Resumen
              </p>
              <div className="mt-5 space-y-4 text-sm text-[#a9b3c9]">
                <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8899aa]">
                    Pitches en ranking
                  </p>
                  <p className="mt-2 text-3xl font-black text-white">{rankingRows.length}</p>
                </div>
                <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8899aa]">
                    Seleccionados
                  </p>
                  <p className="mt-2 text-3xl font-black text-[#83ce00]">
                    {selectedPitchIds.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Exportaciones
              </p>
              <FeedbackPanel
                title="No pudimos generar el archivo"
                items={exportError ? getFriendlyErrorItems(exportError) : []}
                tone="error"
                className="mt-4"
              />
              <div className="mt-5 flex flex-col gap-3">
                <Button
                  type="button"
                  onClick={() => handleExportCombined(selectedRows, "selected")}
                  disabled={selectedRows.length === 0 || isExportingSelection}
                  className="justify-between rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                >
                  <span>Exportar seleccionados</span>
                  <Files className="size-4" />
                </Button>

                <Button
                  type="button"
                  onClick={() => handleExportCombined(rankingRows, "all")}
                  disabled={rankingRows.length === 0 || isExportingSelection}
                  variant="outline"
                  className="justify-between rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                >
                  <span>Exportar todo el evento</span>
                  <Download className="size-4" />
                </Button>
              </div>

              <div className="mt-5 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9]">
                El archivo combinado sale ordenado por porcentaje, del pitch con mejor resultado al mas bajo.
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
            <div className="flex flex-col gap-4 border-b border-[#263550] bg-[#121d30] px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                  Ranking exportable
                </p>
                <p className="mt-1 text-sm text-[#a9b3c9]">
                  Marca uno o varios pitches y exporta el conjunto que necesites.
                </p>
              </div>

              <label className="inline-flex items-center gap-3 rounded-full border border-[#263550] bg-[#0d1526] px-4 py-2 text-sm text-white">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="size-4 accent-[#83ce00]"
                />
                Seleccionar todos
              </label>
            </div>

            {isLoading ? (
              <div className="px-5 py-10 text-sm text-[#8899aa]">Cargando exportaciones...</div>
            ) : rankingRows.length === 0 ? (
              <div className="px-5 py-10 text-sm text-[#8899aa]">
                Este evento todavia no tiene pitches para exportar.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-[#263550] bg-[#0d1526] text-[10px] uppercase tracking-[0.24em] text-[#8899aa]">
                      <th className="px-4 py-3 font-medium">Sel.</th>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Pitch</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium text-right">Votos</th>
                      <th className="px-4 py-3 font-medium text-right">Porcentaje</th>
                      <th className="px-4 py-3 font-medium text-right">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingRows.map((row, index) => {
                      const isSelected = selectedPitchIds.includes(row.id);

                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-[#263550] text-sm text-[#d7d8e5] ${
                            index === 0
                              ? "bg-[linear-gradient(90deg,rgba(131,206,0,0.10),rgba(13,21,38,0.08))]"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePitchSelection(row.id)}
                              className="size-4 accent-[#83ce00]"
                            />
                          </td>
                          <td className="px-4 py-4 font-bold text-[#83ce00]">
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-white">{row.name}</span>
                              <span
                                className="block max-w-xl truncate text-xs text-[#8899aa]"
                                title={row.description ?? ""}
                              >
                                {row.description}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                row.pitchStatus === "OPEN"
                                  ? "bg-[#13210a] text-[#83ce00]"
                                  : "bg-[#2a1018] text-[#ff8cab]"
                              }`}
                            >
                              {formatPitchStatus(row.pitchStatus)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right text-[#a9b3c9]">
                            {row.votesCount}
                          </td>
                          <td className="px-4 py-4 text-right font-semibold text-[#ccff00]">
                            {formatPercentage(row.scoreAvg)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                onClick={() => handleProjectPitch(row.id)}
                                className="inline-flex h-9 items-center gap-2 rounded-full border border-[#263550] bg-[#0d1526] px-4 text-xs font-bold text-white transition hover:bg-[#121d30]"
                              >
                                <ArrowUpRight className="size-4" />
                                Proyectar
                              </Button>
                              <Button
                                type="button"
                                onClick={() => handleExportPitch(row.id, row.name)}
                                disabled={isExportingPitchId === row.id}
                                className="rounded-full bg-[#83ce00] px-4 text-xs font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                              >
                                <FileDown className="size-4" />
                                {isExportingPitchId === row.id ? "Exportando..." : "Exportar"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
