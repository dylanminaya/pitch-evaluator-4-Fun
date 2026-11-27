"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Copy, Mail, Users } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  useCancelOrganizerInvitation,
  useCreateOrganizerInvitation,
  useEventOrganizers,
  useOrganizerInvitations,
  useRemoveOrganizer,
} from "@/hooks/dashboard";

type InviteResult = {
  email: string;
  emailSent: boolean;
  acceptUrl?: string;
};

// Copia el link; si el portapapeles falla, deja el texto seleccionado.
async function copyLink(url: string, elementId: string) {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    const element = document.getElementById(elementId);
    const selection = window.getSelection();
    if (element && selection) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return false;
  }
}

export default function EventTeamPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const [email, setEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { mutateAsync, isPending, error } = useCreateOrganizerInvitation();
  const {
    mutateAsync: cancelInvitation,
    isPending: isCancelingInvitation,
  } = useCancelOrganizerInvitation();
  const {
    mutateAsync: removeOrganizer,
    isPending: isRemovingOrganizer,
  } = useRemoveOrganizer();
  const {
    data: invitations = [],
    isLoading,
  } = useOrganizerInvitations(eventId);
  const {
    data: organizers = [],
    isLoading: isLoadingOrganizers,
  } = useEventOrganizers(eventId);

  async function handleInvite() {
    if (!email.trim()) return;

    setInviteResult(null);
    setCopiedId(null);

    const invitation = await mutateAsync({
      eventId,
      data: {
        email: email.trim(),
        role: "ORGANIZER",
      },
    });

    setInviteResult({
      email: invitation.email,
      emailSent: invitation.emailSent ?? true,
      acceptUrl: invitation.acceptUrl,
    });
    setEmail("");
  }

  async function handleCopy(url: string, elementId: string) {
    const copied = await copyLink(url, elementId);
    setCopiedId(copied ? elementId : null);
  }

  async function handleCancelInvitation(invitationId: string) {
    await cancelInvitation({
      eventId,
      invitationId,
    });
  }

  async function handleRemoveOrganizer(organizerId: string) {
    await removeOrganizer({
      eventId,
      organizerId,
    });
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
                Equipo del evento
              </span>
              <span className="text-sm text-[#a9b3c9]">
                Invita y gestiona organizadores del evento.
              </span>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
              <Mail className="size-4 text-[#8899aa]" />
              Invitar organizador
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <label className="text-xs font-bold uppercase italic tracking-[0.24em] text-[#8899aa]">
                Email
              </label>

              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="organizer@email.com"
                className="h-12 rounded-2xl border-[#263550] bg-[#0d1526] px-4 text-white placeholder:text-[#66738f]"
              />

              {error && (
                <div className="rounded-2xl border border-[#5a2433] bg-[#2a1018] p-3 text-sm text-[#ff8cab]">
                  {error.message}
                </div>
              )}

              {inviteResult && inviteResult.emailSent && (
                <div className="rounded-2xl border border-[#3d5a12] bg-[#16240a] p-3 text-sm text-[#b8f05a]">
                  Invitacion enviada a {inviteResult.email}
                </div>
              )}

              {inviteResult && !inviteResult.emailSent && (
                <div className="flex flex-col gap-3 rounded-2xl border border-[#6b5414] bg-[#2a210a] p-3 text-sm text-[#ffd666]">
                  <p>
                    No pudimos enviar el correo de invitación a{" "}
                    {inviteResult.email}. Comparte este enlace manualmente:
                  </p>
                  {inviteResult.acceptUrl && (
                    <>
                      <p
                        id="invite-result-url"
                        className="break-all rounded-xl border border-[#263550] bg-[#0d1526] px-3 py-2 font-mono text-xs text-white select-all"
                      >
                        {inviteResult.acceptUrl}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handleCopy(
                            inviteResult.acceptUrl!,
                            "invite-result-url",
                          )
                        }
                        className="self-start rounded-full border-[#263550] bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#83ce00] hover:bg-[#121d30] hover:text-[#a7ea2e]"
                      >
                        <Copy className="size-3" />
                        {copiedId === "invite-result-url"
                          ? "Copiado"
                          : "Copiar enlace"}
                      </Button>
                    </>
                  )}
                </div>
              )}

              <Button
                type="button"
                onClick={handleInvite}
                disabled={isPending}
                className="mt-2 rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
              >
                {isPending ? "Enviando..." : "Invitar organizador"}
              </Button>
            </div>
          </section>

          <div className="flex flex-col gap-6">
            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                <Users className="size-4 text-[#8899aa]" />
                Organizadores actuales
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {isLoadingOrganizers ? (
                  <div className="rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm text-[#a9b3c9]">
                    Cargando organizadores...
                  </div>
                ) : organizers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm text-[#a9b3c9]">
                    No hay organizadores cargados.
                  </div>
                ) : (
                  organizers.map((organizer) => (
                    <article
                      key={organizer.id}
                      className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {organizer.name ?? organizer.email}
                          </p>
                          <p className="mt-1 text-xs text-[#8899aa]">
                            {organizer.email}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="rounded-full border border-[#263550] bg-[#121d30] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#83ce00]">
                            {organizer.id.includes("-owner") ? "Organizador principal" : "Organizador"}
                          </div>

                          {!organizer.id.includes('-owner') && (
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isRemovingOrganizer}
                              onClick={() => handleRemoveOrganizer(organizer.id)}
                              className="rounded-full border-[#5a2433] bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8cab] hover:bg-[#2a1018] hover:text-[#ffb5c7]"
                            >
                              {isRemovingOrganizer ? "Quitando..." : "Quitar"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-[#263550] bg-[#1a2640] p-6 shadow-[0_18px_45px_rgba(2,8,23,0.35)]">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.24em] text-[#83ce00]">
                <Users className="size-4 text-[#8899aa]" />
                Invitaciones pendientes
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {isLoading ? (
                  <div className="rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm text-[#a9b3c9]">
                    Cargando invitaciones...
                  </div>
                ) : invitations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm text-[#a9b3c9]">
                    No hay invitaciones pendientes.
                  </div>
                ) : (
                  invitations.map((invitation) => (
                    <article
                      key={invitation.id}
                      className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {invitation.email}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#8899aa]">
                            {invitation.status === "PENDING" ? "Pendiente" : invitation.status}
                          </p>
                          {invitation.acceptUrl && (
                            <p
                              id={`invite-url-${invitation.id}`}
                              className="mt-1 max-w-[320px] truncate font-mono text-[11px] text-[#66738f] select-all"
                            >
                              {invitation.acceptUrl}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="rounded-full border border-[#263550] bg-[#121d30] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#83ce00]">
                            {"Organizador"}
                          </div>

                          {invitation.acceptUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                handleCopy(
                                  invitation.acceptUrl!,
                                  `invite-url-${invitation.id}`,
                                )
                              }
                              className="rounded-full border-[#263550] bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#83ce00] hover:bg-[#121d30] hover:text-[#a7ea2e]"
                            >
                              <Copy className="size-3" />
                              {copiedId === `invite-url-${invitation.id}`
                                ? "Copiado"
                                : "Copiar enlace"}
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            disabled={isCancelingInvitation}
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="rounded-full border-[#5a2433] bg-transparent px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff8cab] hover:bg-[#2a1018] hover:text-[#ffb5c7]"
                          >
                            {isCancelingInvitation ? "Cancelando..." : "Cancelar"}
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
