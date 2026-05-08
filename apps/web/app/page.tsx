import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/login-form";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; switchAccount?: string }>;
}) {
  const { redirect, switchAccount } = await searchParams;

  return (
    <AuthShell
      eyebrow="Acceso organizer"
      title="Entra y corre tu evento"
      description="Gestiona pitches, activa votaciones y proyecta resultados con el mismo lenguaje visual de Pitch 4 Fun."
      ctaHref="/signup"
      ctaLabel="Crear cuenta organizer"
      accent="Accede con tu cuenta para administrar el evento, activar el QR del pitch actual y seguir el ranking en tiempo real."
    >
        <LoginForm redirectTo={redirect} forceSignOut={switchAccount === "1"} />
    </AuthShell>
  );
}
