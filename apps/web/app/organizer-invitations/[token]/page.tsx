"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock3, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useSession } from "@/lib/better-auth/auth-client";
import {
  useAcceptOrganizerInvitation,
  useOrganizerInvitation,
} from "@/hooks/dashboard";

export default function OrganizerInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const autoAcceptStartedRef = useRef(false);
  const { data: sessionData, isPending: isLoadingSession } = useSession();
  const {
    data: invitation,
    isLoading,
    error,
  } = useOrganizerInvitation(token);
  const {
    mutateAsync: acceptInvitation,
    isPending: isAccepting,
    error: acceptError,
  } = useAcceptOrganizerInvitation();

  async function handleAccept() {
    if (!token) return;

    const result = await acceptInvitation(token);
    window.location.assign(`/dashboard?eventId=${result.eventId}`);
  }

  const sessionUserEmail =
    sessionData?.user && typeof sessionData.user === "object" && "email" in sessionData.user
      ? String(sessionData.user.email ?? "")
      : null;
  const emailMatchesSession =
    invitation !== undefined &&
    sessionUserEmail !== null &&
    sessionUserEmail.toLowerCase() === invitation.email.toLowerCase();
  const invitationPath = `/organizer-invitations/${token}`;
  const authRedirect = `/?redirect=${encodeURIComponent(invitationPath)}`;
  const signupRedirect = `/signup?redirect=${encodeURIComponent(invitationPath)}`;
  const switchAuthRedirect = `${authRedirect}&switchAccount=1`;
  const switchSignupRedirect = `${signupRedirect}&switchAccount=1`;

  function goToLogin() {
    window.location.assign(switchAuthRedirect);
  }

  function goToSignup() {
    window.location.assign(switchSignupRedirect);
  }

  function goToDashboard(eventId: string) {
    window.location.assign(`/dashboard?eventId=${eventId}`);
  }

  useEffect(() => {
    if (
      !token ||
      !invitation ||
      invitation.status !== "PENDING" ||
      !sessionData ||
      !emailMatchesSession ||
      autoAcceptStartedRef.current
    ) {
      return;
    }

    autoAcceptStartedRef.current = true;

    acceptInvitation(token)
      .then((result) => {
        goToDashboard(result.eventId);
      })
      .catch(() => {
        autoAcceptStartedRef.current = false;
      });
  }, [
    acceptInvitation,
    emailMatchesSession,
    invitation,
    sessionData,
    token,
  ]);

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
        No pudimos cargar esta invitacion.
      </main>
    );
  }

  const isPending = invitation.status === "PENDING";
  const isAccepted = invitation.status === "ACCEPTED";

  return (
    <main className="min-h-svh bg-[#0d1526] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] max-w-[1440px] items-center justify-center">
        <section className="w-full max-w-[620px] overflow-hidden rounded-[24px] border border-[#263550] bg-[#1a2640] shadow-[0_20px_60px_rgba(2,8,23,0.42)]">
          <div className="border-b border-[#263550] bg-[linear-gradient(135deg,#1a2640_0%,#0d1526_55%,#121d30_100%)] px-8 py-10 text-center">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase italic tracking-[0.28em] text-[#83ce00]">
              <span>PITCH 4 FUN</span>
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">
              Invitacion para colaborar
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#a9b3c9]">
              Te invitaron a formar parte del equipo organizador de un evento.
            </p>
          </div>

          <div className="px-8 py-8">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <ShieldCheck className="size-4 text-[#83ce00]" />
                  <span>Evento</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{invitation.eventName}</p>
              </div>
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <Mail className="size-4 text-[#00f0ff]" />
                  <span>Invitado</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{invitation.email}</p>
              </div>
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <CheckCircle2 className="size-4 text-[#83ce00]" />
                  <span>Invitado por</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{invitation.invitedByEmail}</p>
              </div>
              <div className="rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-3">
                <div className="inline-flex items-center gap-2 text-xs text-[#8899aa]">
                  <Clock3 className="size-4 text-[#00f0ff]" />
                  <span>Estado</span>
                </div>
                <p className="mt-2 text-sm font-medium text-white">{invitation.status}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-[#263550] bg-[#0d1526] px-4 py-4 text-sm leading-6 text-[#a9b3c9]">
              Al aceptar, tu cuenta tendra acceso al equipo organizador del evento con el rol{" "}
              <span className="font-semibold text-white">{invitation.role}</span>.
            </div>

            {acceptError && (
              <div className="mt-6 rounded-2xl border border-[#5a2433] bg-[#2a1018] p-3 text-sm text-[#ff8cab]">
                {acceptError.message}
              </div>
            )}

            {isAccepted ? (
              !sessionData ? (
                <div className="mt-6 flex gap-3">
                  <Button
                    type="button"
                    onClick={goToLogin}
                    className="h-12 flex-1 rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                  >
                    Aceptar invitacion
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToSignup}
                    className="h-12 flex-1 rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                  >
                    Crear cuenta
                  </Button>
                </div>
              ) : !emailMatchesSession ? (
                <div className="mt-6 rounded-2xl border border-[#5a2433] bg-[#2a1018] px-4 py-4 text-sm text-[#ff8cab]">
                  Esta invitacion ya fue aceptada. Entra con{" "}
                  <span className="font-semibold">{invitation.email}</span> para abrir el dashboard.
                </div>
              ) : (
                <div className="mt-6 flex gap-3">
                  <Button
                    type="button"
                    onClick={() => goToDashboard(invitation.eventId)}
                    className="h-12 flex-1 rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                  >
                    Ir al dashboard
                  </Button>
                  {/* <Button
                    type="button"
                    variant="outline"
                    onClick={() => window.location.assign("/events")}
                    className="h-12 flex-1 rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                  >
                    Ver eventos
                  </Button> */}
                </div>
              )
            ) : !isPending ? (
              <div className="mt-6 rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-4 text-sm text-[#a9b3c9]">
                Esta invitacion ya no esta disponible para aceptar.
              </div>
            ) : isLoadingSession ? (
              <div className="mt-6 rounded-2xl border border-[#263550] bg-[#0d1526] px-4 py-4 text-sm text-[#a9b3c9]">
                Revisando tu sesion...
              </div>
            ) : !sessionData ? (
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  onClick={goToLogin}
                  className="h-12 flex-1 rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                >
                  Aceptar invitacion
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={goToSignup}
                  className="h-12 flex-1 rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                >
                  Crear cuenta
                </Button>
              </div>
            ) : !emailMatchesSession ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-[#5a2433] bg-[#2a1018] px-4 py-4 text-sm text-[#ff8cab]">
                  Tu sesion actual no coincide con el email invitado. Debes entrar con{" "}
                  <span className="font-semibold">{invitation.email}</span>.
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={goToLogin}
                    className="h-12 flex-1 rounded-full bg-[#ff8cab] text-sm font-bold italic text-[#0d1526] transition-colors hover:bg-[#ffb5c7]"
                  >
                    Cambiar sesion
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToSignup}
                    className="h-12 flex-1 rounded-full border-[#00f0ff] bg-[#071a2c] text-[#dffcff] transition-colors hover:bg-[#00f0ff] hover:text-[#0d1526]"
                  >
                    Crear cuenta
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex gap-3">
                <Button
                  type="button"
                  onClick={handleAccept}
                  disabled={isAccepting}
                  className="h-12 flex-1 rounded-full bg-[#83ce00] text-sm font-bold italic text-[#0d1526] hover:bg-[#a7ea2e]"
                >
                  {isAccepting ? "Aceptando..." : "Aceptar invitacion"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.assign("/events")}
                  className="h-12 flex-1 rounded-full border-[#263550] bg-[#0d1526] text-white hover:bg-[#121d30] hover:text-white"
                >
                  Volver
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
