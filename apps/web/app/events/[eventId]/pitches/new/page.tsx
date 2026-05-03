"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Palette, QrCode, Sparkles } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { FeedbackPanel } from "@/components/feedback-panel";
import { useCreatePitch } from "@/hooks/dashboard";
import { uploadPitchPresentation } from "@/lib/dashboard-api";
import { getFriendlyErrorItems, getPitchFormIssues } from "@/lib/user-feedback";

export default function NewPitchPage() {
  const params = useParams<{ eventId: string }>();
  const router = useRouter();
  const eventId = params.eventId;
  const { mutateAsync, isPending, error } = useCreatePitch();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#83CE00");
  const [logoUrl, setLogoUrl] = useState("");
  const [presentationFile, setPresentationFile] = useState<File | null>(null);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const formIssues = useMemo(
    () => getPitchFormIssues({ name, description, color, logoUrl }),
    [color, description, logoUrl, name],
  );
  const errorItems = error ? getFriendlyErrorItems(error) : [];

  function handleColorTextChange(value: string) {
    const normalized = value.startsWith("#") ? value.toUpperCase() : `#${value.toUpperCase()}`;
    setColor(normalized.slice(0, 7));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasTriedSubmit(true);

    if (formIssues.length > 0) {
      return;
    }

    const createdPitch = await mutateAsync({
      eventId,
      name,
      description,
      color,
      logoUrl: logoUrl.trim() || null,
    });

    if (presentationFile) {
      await uploadPitchPresentation(createdPitch.id, presentationFile);
    }

    router.push(
      `/dashboard?eventId=${createdPitch.eventId}&pitchId=${createdPitch.id}`,
    );
  }

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
                Nuevo pitch
              </span>
              <span className="text-sm text-[#a9b3c9]">
                Crea el proyecto y habilita su invitacion y QR.
              </span>
            </div>
          </div>

          <Button
            form="new-pitch-form"
            type="submit"
            className="rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
            disabled={isPending}
          >
            {isPending ? "Guardando..." : "Guardar pitch"}
          </Button>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form
            id="new-pitch-form"
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]"
          >
            <div className="flex flex-col gap-2 border-b border-[#263550] pb-5">
              <p className="text-[11px] font-bold uppercase italic tracking-[0.3em] text-[#83ce00]">
                Informacion del pitch
              </p>
              {/* <p className="text-sm text-[#a9b3c9]">
                Este formulario crea el pitch real en la base de datos y luego el
                dashboard podra generar el QR publico del evento para acceder a todos los pitches.
              </p> */}
            </div>

            <div className="mt-6 flex flex-col gap-6">
              <FeedbackPanel
                title="Revisa esto antes de guardar"
                items={hasTriedSubmit ? formIssues : []}
                tone="warning"
              />

              <FeedbackPanel
                title="No pudimos guardar el pitch"
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
                  disabled={isPending}
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
                  disabled={isPending}
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
                      disabled={isPending}
                      className="h-12 w-16 cursor-pointer rounded-2xl border border-[#263550] bg-[#0d1526] p-2"
                    />
                    <Input
                      value={color}
                      onChange={(event) => handleColorTextChange(event.target.value)}
                      placeholder="#83CE00"
                      disabled={isPending}
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
                    disabled={isPending}
                    className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                  PowerPoint opcional
                </label>
                <Input
                  type="file"
                  accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  onChange={(event) => setPresentationFile(event.target.files?.[0] ?? null)}
                  disabled={isPending}
                  className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 py-2 text-white file:mr-4 file:rounded-full file:border-0 file:bg-[#83ce00] file:px-4 file:py-1.5 file:text-sm file:font-bold file:text-[#0d1526]"
                />
                <p className="text-xs text-[#8899aa]">
                  Sube un archivo .ppt o .pptx. Se proyectara con un visor de PowerPoint en el navegador.
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
                  Proyecto nuevo
                </div>
                <h2 className="mt-5 text-3xl font-black tracking-tight text-white">
                  {name || "Nombre del pitch"}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#a9b3c9]">
                  {description || "Descripcion del pitch."}
                </p>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                <QrCode className="size-4 text-[#8899aa]" />
                Despues de guardar
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9]">
                <div className="inline-flex items-center gap-2 font-semibold text-white">
                  <Sparkles className="size-4 text-[#83ce00]" />
                  Tip
                </div>
                <p className="mt-2">
                  Usa un nombre corto y una descripcion clara: explica el problema,
                  la solucion y el beneficio principal en una o dos frases. Asi sera
                  mas facil identificar el pitch en el dashboard y para quienes votan
                  por primera vez.
                </p>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
