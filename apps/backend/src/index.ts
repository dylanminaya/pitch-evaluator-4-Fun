import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { validateServerEnv } from "@workspace/shared/env/server";
import { auth } from "./auth.js";
import { eventRouter } from "./model/api/event.api.js";
import { organizerInvitationRouter } from "./model/api/organizer-invitation.api.js";
import { pitchRouter } from "./model/api/pitch.api.js";
import { voteRouter } from "./model/api/vote.api.js";

// Carga variables de entorno y crea la app Express.
const env = validateServerEnv();
const app = express();

// Permite requests del frontend con cookies/sesion.
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

// Endpoint interno de Better Auth.
app.all("/api/auth/*", toNodeHandler(auth));

// Permite leer JSON en el body de las requests.
app.use(express.json());

// Health check basico para saber si el backend esta vivo.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routers principales de la API.
app.use("/api/event", eventRouter);
app.use("/api/organizer-invitations", organizerInvitationRouter);
app.use("/api/pitch", pitchRouter);
app.use("/api/vote", voteRouter);

// Levanta el servidor en el puerto configurado.
app.listen(env.PORT, () => {
  console.log(`Backend server running on http://localhost:${env.PORT}`);
});
