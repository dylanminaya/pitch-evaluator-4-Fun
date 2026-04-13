import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { validateServerEnv } from "@workspace/shared/env/server";
import type { Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";

const env = validateServerEnv();

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

//auth session
//te dice quien esta haciendo la peticion
export const getSessionFromRequest = async (req: Request) => {
  return auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
};

//quien esta logueado
export const requireSession = async (req: Request, res: Response) => {
  const session = await getSessionFromRequest(req);

  if (!session) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  return session;
};
