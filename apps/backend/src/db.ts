import { Pool } from "pg";
import { validateServerEnv } from "@workspace/shared/env/server";

// Carga DATABASE_URL y demas variables del backend.
const env = validateServerEnv();

// Pool compartido para todas las consultas a Postgres.
export const db = new Pool({
    connectionString: env.DATABASE_URL,
})
