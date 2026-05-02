import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { validateServerEnv } from "@workspace/shared/env/server";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

// Carga la configuracion del backend.
const env = validateServerEnv();

// Configura Better Auth con Postgres y login por email/password.
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.FRONTEND_URL, "http://127.0.0.1:3000"],
  database: new Pool({
    connectionString: env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
});

// Intenta leer la sesion actual desde los headers de la request.
export const getSessionFromRequest = async (req: Request) => {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
};

// Exige sesion y responde 401 si no hay usuario autenticado.
export const requireSession = async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);

  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  return session;
};
