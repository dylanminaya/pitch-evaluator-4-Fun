"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Palette, QrCode, Sparkles } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { FeedbackPanel } from "@/components/feedback-panel";
import { usePitches, useUpdatePitch } from "@/hooks/dashboard";
import { uploadPitchPresentation } from "@/lib/dashboard-api";
import { getFriendlyErrorItems, getPitchFormIssues } from "@/lib/user-feedback";
import type { DashboardPitch } from "@workspace/shared/api";

function EditPitchForm({
  eventId,
  pitchId,
  pitch,
}: {
  eventId: string;
  pitchId: string;
  pitch: DashboardPitch;
}) {
  const router = useRouter();
  const { mutateAsync, error } = useUpdatePitch();
  const [name, setName] = useState(pitch.name);
  const [description, setDescription] = useState(pitch.description);
  const [color, setColor] = useState(pitch.color);
  const [logoUrl, setLogoUrl] = useState(pitch.logoUrl ?? "");
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const isSavingRef = useRef(false);
  const formIssues = useMemo(
    () => getPitchFormIssues({ name, description, color, logoUrl }),
    [color, description, logoUrl, name],
  );
  const errorItems = saveError || error ? getFriendlyErrorItems(saveError ?? error) : [];

  function handleColorTextChange(value: string) {
    // Normalize manual color input so the API always receives a proper hex value.
    const normalized = value.startsWith("#")
      ? value.toUpperCase()
      : `#${value.toUpperCase()}`;
    setColor(normalized.slice(0, 7));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasTriedSubmit(true);

    if (formIssues.length > 0) {
      return;
    }

    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);

    try {
      // Send only editable fields, then return to dashboard focused on the updated pitch.
      const updatedPitch = await mutateAsync({
        pitchId,
        data: {
          name,
          description,
          color,
          logoUrl: logoUrl.trim() || null,
        },
      });

      if (presentationFile) {
        await uploadPitchPresentation(updatedPitch.id, presentationFile);
      }

      router.push(
        `/dashboard?eventId=${updatedPitch.eventId}&pitchId=${updatedPitch.id}`,
      );
    } catch (error) {
      setSaveError(error);
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#0d1526] text-white">
      <div className="mx-auto flex min-h-svh w-full max-w-[1440px] flex-col px-4 py-4 md:px-8 md:py-6">
        <header className="flex flex-col gap-5 rounded-[20px] border border-[#263550] bg-[#121d30] px-5 py-4 shadow-[0_22px_60px_rgba(2,8,23,0.42)] md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard?eventId=${eventId}&pitchId=${pitchId}`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8899aa] transition hover:text-white"
            >
              <ArrowLeft className="size-4" />
              <span>Volver al dashboard</span>
            </Link>
            <div className="hidden h-8 w-px bg-[#263550] md:block" />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Editar pitch
              </span>
              <span className="text-sm text-[#a9b3c9]">
                Actualiza el proyecto y guarda los cambios del pitch seleccionado.
              </span>
            </div>
          </div>

          <Button
            form="edit-pitch-form"
            type="submit"
            className="rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
            disabled={isSaving}
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form
            id="edit-pitch-form"
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]"
          >
            <div className="flex flex-col gap-2 border-b border-[#263550] pb-5">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Informacion del pitch
              </p>
              <p className="text-sm text-[#a9b3c9]">
                Puedes editar nombre, descripcion, color y logo del pitch.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-6">
              <FeedbackPanel
                title="Revisa esto antes de guardar"
                items={hasTriedSubmit ? formIssues : []}
                tone="warning"
              />

              <FeedbackPanel
                title="No pudimos actualizar el pitch"
                items={errorItems}
                tone="error"
              />

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                  Nombre del pitch
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Ej. EcoTrack AI"
                  disabled={isSaving}
                  className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f]"
                />
                <p className="text-xs text-[#8899aa]">
                  El nombre del pitch debe tener entre 3 y 25 caracteres.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                  Descripcion
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Describe la solucion, el problema y el valor del pitch."
                  disabled={isSaving}
                  className="min-h-36 rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3 text-sm text-white outline-none placeholder:text-[#66738f]"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                    Color del pitch
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value.toUpperCase())}
                      disabled={isSaving}
                      className="h-12 w-16 cursor-pointer rounded-2xl border border-[#263550] bg-[#0d1526] p-2"
                    />
                    <Input
                      value={color}
                      onChange={(event) => handleColorTextChange(event.target.value)}
                      placeholder="#83CE00"
                      disabled={isSaving}
                      className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f]"
                    />
                  </div>
                  <p className="text-xs text-[#8899aa]">
                    Usa el selector o escribe un HEX valido como `#83CE00` o `#0595F0`.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                    Logo URL opcional
                  </label>
                  <Input
                    value={logoUrl}
                    onChange={(event) => setLogoUrl(event.target.value)}
                    placeholder="https://..."
                    disabled={isSaving}
                    className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                  Presentación opcional
                </label>
                <p className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3 text-xs leading-5 text-[#a9b3c9]">
                  Tamano maximo permitido: 50 MB. Usa archivos .ppt, .pptx o .pdf.
                </p>
                <Input
                  type="file"
                  accept=".ppt,.pptx,.pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf"
                  onChange={(event) => setPresentationFile(event.target.files?.[0] ?? null)}
                  disabled={isSaving}
                  className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 py-2 text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#83ce00] file:px-4 file:py-1.5 file:text-sm file:font-bold file:text-[#0d1526]"
                />
                <p className="text-xs text-[#8899aa]">
                  {pitch.presentationFileName
                    ? `Archivo actual: ${pitch.presentationFileName}. Sube otro para reemplazarlo.`
                    : "La presentacion se preparara como diapositivas para proyectarla en el navegador."}
                </p>
              </div>
            </div>
          </form>

          <aside className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                <Palette className="size-4 text-[#8899aa]" />
                Preview
              </div>
              <div className="mt-5 rounded-[24px] border border-[#263550] bg-[#0d1526] p-5">
                <div
                  className="inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase italic tracking-[0.24em] text-white"
                  style={{ backgroundColor: `${color}33` }}
                >
                  Pitch en edicion
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-white">
                  {name || "Nombre del pitch"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#a9b3c9]">
                  {description || "La descripcion actualizada aparecera aqui antes de guardar."}
                </p>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                <QrCode className="size-4 text-[#8899aa]" />
                Antes de guardar
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9]">
                <div className="inline-flex items-center gap-2 font-semibold text-white">
                  <Sparkles className="size-4 text-[#83ce00]" />
                  Tip
                </div>
                <p className="mt-2">
                  Revisa bien color, nombre y descripcion antes de guardar para que el dashboard muestre el pitch actualizado.
                </p>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function EditPitchPage() {
  // Read both ids from the dynamic route so we know what event and pitch are being edited.
  const params = useParams<{ eventId: string; pitchId: string }>();
  const eventId = params.eventId;
  const pitchId = params.pitchId;
  // Reuse the event pitch list and extract the current pitch from there.
  const { data: pitches = [], isLoading, error: loadError } = usePitches(eventId);
  const pitch = pitches.find((item) => item.id === pitchId);

  if (isLoading) {
    // Loading state while we fetch the pitch list for the selected event.
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] text-[#a9b3c9]">
        Cargando pitch...
      </main>
    );
  }

  if (loadError || !pitch) {
    // Guard clause for invalid url, missing pitch, or failed request.
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#0d1526] px-6 text-center text-[#a9b3c9]">
        No pudimos cargar el pitch para editar.
      </main>
    );
  }

  return <EditPitchForm eventId={eventId} pitchId={pitchId} pitch={pitch} />;
}
