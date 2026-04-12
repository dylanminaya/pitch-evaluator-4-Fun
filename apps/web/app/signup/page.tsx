import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "@/components/signup-form";

export default function Page() {
  return (
    <AuthShell
      eyebrow="Registro organizer"
      title="Crea tu base de control"
      description="Configura tu acceso para levantar hackathons, invitar equipos y mover el flujo completo desde un solo panel."
      ctaHref="/"
      ctaLabel="Ya tengo cuenta"
      accent="Registra tu cuenta y en el siguiente paso podrás entrar al dashboard para crear eventos, criterios y sesiones de voto."
    >
        <SignupForm />
    </AuthShell>
  );
}
