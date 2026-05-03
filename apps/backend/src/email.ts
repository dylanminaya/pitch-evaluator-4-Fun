import { Resend } from "resend";
import { validateServerEnv } from "@workspace/shared/env/server";

// Carga las variables de entorno del backend.
const env = validateServerEnv();

// Cliente de Resend reutilizable.
export const resend = new Resend(env.RESEND_API_KEY);

// Envia el correo con el link para aceptar la invitacion.
export async function sendOrganizerInvitationEmail(params: {
  to: string;
  eventName: string;
  inviterEmail: string;
  inviteUrl: string;
}) {
  // Datos que se interpolan en el asunto y el HTML.
  const { to, eventName, inviterEmail, inviteUrl } = params;

  // Resend envia el correo usando el remitente configurado en .env.
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: `Invitacion para organizar ${eventName}`,
    // HTML simple del correo con boton y URL de respaldo.
    html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h2>Has sido invitado a colaborar en un evento</h2>
            <p><strong>${inviterEmail}</strong> te invito a ser organizador del evento <strong>${eventName}</strong>.</p>
            <p>Haz clic en el siguiente enlace para aceptar la invitacion:</p>
                <p>
                    <!-- El token ya viene incluido dentro de inviteUrl. -->
                    <a href="${inviteUrl}" style="display: inline-block; padding: 12px 18px; background: #83ce00; color: #0d1526; text-decoration: none; border-radius: 999px; font-weight: bold;">
                        Aceptar invitacion
                    </a>
                </p>
            <p>Si el boton no funciona, copia y pega esta URL en tu navegador:</p>
            <p>${inviteUrl}</p>
        </div>
        `,
  });

  if (error) {
    throw new Error(
      `Resend failed to send organizer invitation: ${error.name} ${error.statusCode ?? ""} ${error.message}`.trim(),
    );
  }

  return data;
}
