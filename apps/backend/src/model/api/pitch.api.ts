import { Router } from "express";
import express from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { requireSession } from "../../auth.js";
import { db } from "../../db.js";
import {
  createPitchSchema,
  updatePitchSchema,
  updatePitchStatusSchema,
} from "../schema/pitch.schema.js";
import { canManageEvent, getEventIdForPitch } from "../event.permissions.js";
import {
  buildCriteriaAveragesSql,
  buildWeightedScoreSql,
  normalizeEventCriteria,
} from "../criteria.js";
import { validateServerEnv } from "@workspace/shared/env/server";
import { presentVote } from "../../presenter/vote.presenter.js";
import { presentPitch, presentPitchComment, presentPitchDetail,presentPitchSummary, presentPublicPitch } from "../../presenter/pitch.presenter.js";
import {
  dashboardPitchSchema,
  dashboardPitchDetailSchema,
  dashboardPitchCommentSchema,
  publicPitchSchema,
} from "@workspace/shared/api";

export const pitchRouter: Router = Router();
const POWERPOINT_CONTENT_TYPES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const presentationUpload = express.raw({
  limit: "50mb",
  type: [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/octet-stream",
  ],
});

// Detecta errores de Postgres por codigo para aplicar fallbacks de schema.
const hasPgErrorCode = (error: unknown, code: string) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === code;

function sanitizePresentationFileName(rawFileName: string) {
  let decodedFileName = rawFileName;

  try {
    decodedFileName = decodeURIComponent(rawFileName);
  } catch {
    decodedFileName = rawFileName;
  }

  return (
    decodedFileName
      .replace(/[^\w.\- ]/g, "")
      .trim()
      .replace(/\s+/g, " ") || "presentation.pptx"
  );
}

function getPowerPointContentType(fileName: string, rawContentType: string | undefined) {
  const contentType = rawContentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const lowerFileName = fileName.toLowerCase();

  if (contentType !== "application/octet-stream" && POWERPOINT_CONTENT_TYPES.has(contentType)) {
    return contentType;
  }

  if (lowerFileName.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  if (lowerFileName.endsWith(".ppt")) {
    return "application/vnd.ms-powerpoint";
  }

  return null;
}

function getPresentationExtension(fileName: string, contentType: string) {
  const lowerFileName = fileName.toLowerCase();
  const lowerContentType = contentType.toLowerCase();

  if (lowerFileName.endsWith(".pptx") || lowerContentType.includes("presentationml")) {
    return "pptx";
  }

  if (lowerFileName.endsWith(".ppt") || lowerContentType.includes("powerpoint")) {
    return "ppt";
  }

  return "pptx";
}

function runProcess(command: string, args: string[], timeoutMs = 45000) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timed out`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || `${command} failed`));
    });
  });
}

async function convertPresentationBufferToPdf(
  buffer: Buffer,
  fileName: string,
  contentType: string,
) {
  const workDir = await mkdtemp(join(tmpdir(), "pitch-presentation-"));
  const extension = getPresentationExtension(fileName, contentType);
  const inputPath = join(workDir, `presentation.${extension}`);
  const outputPath = join(workDir, "presentation.pdf");

  try {
    await writeFile(inputPath, buffer);
    await runProcess(
      "libreoffice",
      [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        workDir,
        inputPath,
      ],
      60000,
    );

    return await readFile(outputPath);
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function writePresentationPdfToTempFile(pitchId: string) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.name,
        p."presentationFileName",
        p."presentationContentType",
        p."presentationFile",
        p."presentationPdf"
      FROM pitch p
      WHERE p.id = $1
    `,
    [pitchId],
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  const row = result.rows[0];
  let presentationPdf = row.presentationPdf;

  if (!presentationPdf) {
    const presentationFile = row.presentationFile;
    const fileName = String(row.presentationFileName ?? "presentation.pptx");
    const contentType =
      row.presentationContentType ??
      getPowerPointContentType(fileName, undefined) ??
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    if (!presentationFile) {
      return null;
    }

    presentationPdf = await convertPresentationBufferToPdf(
      presentationFile,
      fileName,
      contentType,
    );

    await db.query(
      `
        UPDATE pitch
        SET "presentationPdf" = $1
        WHERE id = $2
      `,
      [presentationPdf, row.id],
    );
  }

  const workDir = await mkdtemp(join(tmpdir(), "pitch-presentation-page-"));
  const pdfPath = join(workDir, "presentation.pdf");
  await writeFile(pdfPath, presentationPdf);

  return {
    workDir,
    pdfPath,
    pitchName: String(row.name ?? "presentation"),
    fileName: String(row.presentationFileName ?? "presentation.pptx"),
  };
}

// Lista los pitches de un evento.
pitchRouter.get("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const eventId = req.query.eventId;

  if (typeof eventId !== "string" || eventId.length === 0) {
    return res.status(400).json({ message: "eventId is required" });
  }

  try {
    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        SELECT p.id, p."eventId", p.name, p.description, p.status, p.color, p."logoUrl", p."presentationUrl", p."presentationFileName", p."createdAt"
        FROM pitch p
        WHERE p."eventId" = $1
        ORDER BY p."createdAt" DESC
      `,
      [eventId],
    );

    return res.json(z.array(dashboardPitchSchema).parse(result.rows.map(presentPitch)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to fetch pitches" });
  }
});

// Cambia solo el estado del pitch.
pitchRouter.patch("/:id/status", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = updatePitchStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid pitch status",
      errors: parsed.error.flatten(),
    });
  }

  try {
    const eventId = await getEventIdForPitch(req.params.id);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        UPDATE pitch
        SET status = $1
        WHERE id = $2
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "presentationUrl", "presentationFileName", "createdAt"
      `,
      [parsed.data.status, req.params.id],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update pitch status" });
  }
});

// Crea un pitch nuevo dentro de un evento.
pitchRouter.post("/", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  // Valida el body con Zod antes de tocar la DB.
  const parsed = createPitchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid pitch data",
      errors: parsed.error.flatten(),
    });
  }
  // Datos ya validados.
  const { eventId, name, description, color, logoUrl, presentationUrl } = parsed.data;

  try {
    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        INSERT INTO pitch (id, "eventId", name, description, status, color, "logoUrl", "presentationUrl", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "presentationUrl", "presentationFileName", "createdAt"
      `,
      [
        randomUUID(),
        eventId,
        name,
        description,
        "OPEN",
        color,
        logoUrl ?? null,
        presentationUrl ?? null,
      ],
    );

    return res.status(201).json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to create pitch" });
  }
});

// Actualiza un pitch existente.
pitchRouter.patch("/:id", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  const parsed = updatePitchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid pitch data",
      errors: parsed.error.flatten(),
    });
  }

  const { name, description, color, logoUrl, presentationUrl } = parsed.data;

  try {
    const eventId = await getEventIdForPitch(req.params.id);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        UPDATE pitch
        SET
          name = $1,
          description = $2,
          color = $3,
          "logoUrl" = $4,
          "presentationUrl" = $5
        WHERE id = $6
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "presentationUrl", "presentationFileName", "createdAt"
      `,
      [name, description, color, logoUrl ?? null, presentationUrl ?? null, req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to update pitch" });
  }
});

// Recibe un archivo PowerPoint y prepara sus diapositivas para proyeccion local.
pitchRouter.post("/:pitchId/presentation", presentationUpload, async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ message: "Presentation file is required" });
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const rawFileName = req.header("x-file-name") ?? "presentation.pptx";
    const fileName = sanitizePresentationFileName(rawFileName);
    const contentType = getPowerPointContentType(fileName, req.header("content-type"));

    if (!contentType) {
      return res.status(400).json({
        message: "Only .ppt and .pptx presentation files are supported",
      });
    }

    const pdfBuffer = await convertPresentationBufferToPdf(req.body, fileName, contentType);

    const result = await db.query(
      `
        UPDATE pitch
        SET
          "presentationFileName" = $1,
          "presentationContentType" = $2,
          "presentationFile" = $3,
          "presentationPdf" = $4,
          "presentationUrl" = NULL
        WHERE id = $5
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "presentationUrl", "presentationFileName", "createdAt"
      `,
      [fileName, contentType, req.body, pdfBuffer, req.params.pitchId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.json(dashboardPitchSchema.parse(presentPitch(result.rows[0])));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to prepare presentation" });
  }
});

// Elimina un pitch.
pitchRouter.delete("/:id", async (req, res) => {
  const session = await requireSession(req, res);

  if (!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.id);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
        DELETE FROM pitch
        WHERE id = $1
      `,
      [req.params.id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to delete pitch" });
  }
});

// Endpoint publico para la pantalla de voto.
pitchRouter.get("/public/:pitchId", async (req, res) => {
  try {
    const evaluatorEmailParam = req.query.evaluatorEmail;
    let evaluatorEmail: string | null = null;

    if (typeof evaluatorEmailParam === "string" && evaluatorEmailParam.length > 0) {
      const parsedEmail = z.string().trim().toLowerCase().email().safeParse(evaluatorEmailParam);

      if (!parsedEmail.success) {
        return res.status(400).json({ message: "Invalid evaluator email" });
      }

      evaluatorEmail = parsedEmail.data;
    }

    let result;

    try {
      // Intenta traer tambien los criterios del evento si la columna existe.
      result = await db.query(
        `
          SELECT
            p.id,
            p."eventId",
            p.name,
            p.description,
            p.status AS "pitchStatus",
            p.color,
            p."logoUrl",
            p."presentationUrl",
            p."presentationFileName",
            e.status AS "eventStatus",
            e.criteria
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          WHERE p.id = $1
        `,
        [req.params.pitchId],
      );
    } catch (error) {
      // Fallback para bases viejas sin `criteria`.
      if (!hasPgErrorCode(error, "42703")) {
        throw error;
      }

      result = await db.query(
        `
          SELECT
            p.id,
            p."eventId",
            p.name,
            p.description,
            p.status AS "pitchStatus",
            p.color,
            p."logoUrl",
            NULL AS "presentationUrl",
            NULL AS "presentationFileName",
            e.status AS "eventStatus"
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          WHERE p.id = $1
        `,
        [req.params.pitchId],
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Pitch not found",
      });
    }

    let currentVote = null;

    if (evaluatorEmail) {
      try {
        const existingVoteResult = await db.query(
          `
            SELECT
              id,
              "pitchId",
              "evaluatorId",
              "evaluatorEmail",
              "criteriaScores",
              innovation,
              viability,
              impact,
              presentation,
              comment,
              "createdAt"
            FROM vote
            WHERE "pitchId" = $1
              AND "evaluatorEmail" = $2
            LIMIT 1
          `,
          [req.params.pitchId, evaluatorEmail],
        );

        currentVote =
          (existingVoteResult.rowCount ?? 0) > 0
            ? presentVote(existingVoteResult.rows[0])
            : null;
      } catch (error) {
        if (!hasPgErrorCode(error, "42703")) {
          throw error;
        }

        const existingVoteResult = await db.query(
          `
            SELECT
              id,
              "pitchId",
              "evaluatorId",
              "evaluatorId" AS "evaluatorEmail",
              innovation,
              viability,
              impact,
              presentation,
              comment,
              "createdAt"
            FROM vote
            WHERE "pitchId" = $1
              AND "evaluatorId" = $2
            LIMIT 1
          `,
          [req.params.pitchId, evaluatorEmail],
        );

        currentVote =
          (existingVoteResult.rowCount ?? 0) > 0
            ? presentVote(existingVoteResult.rows[0])
            : null;
      }
    }

    return res.status(200).json(publicPitchSchema.parse({
      ...presentPublicPitch({
        ...result.rows[0],
        hasVoted: Boolean(currentVote),
        currentVote,
      }),
      criteria: normalizeEventCriteria(result.rows[0].criteria),
    }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to get pitch" });
  }
});

// Devuelve el archivo PowerPoint original para el visor de presentaciones.
pitchRouter.get("/public/:pitchId/presentation/file", async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT
          p.name,
          p."presentationFileName",
          p."presentationContentType",
          p."presentationFile"
        FROM pitch p
        WHERE p.id = $1
      `,
      [req.params.pitchId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const presentationFile = result.rows[0].presentationFile;

    if (!presentationFile) {
      return res.status(404).json({ message: "Presentation not found" });
    }

    const safeFileName = sanitizePresentationFileName(
      String(result.rows[0].presentationFileName ?? result.rows[0].name ?? "presentation.pptx"),
    );
    const contentType =
      result.rows[0].presentationContentType ??
      getPowerPointContentType(safeFileName, undefined) ??
      "application/vnd.openxmlformats-officedocument.presentationml.presentation";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(presentationFile);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load presentation file" });
  }
});

// Devuelve metadatos de las diapositivas ya preparadas para proyeccion.
pitchRouter.get("/public/:pitchId/presentation/meta", async (req, res) => {
  const tempPdf = await writePresentationPdfToTempFile(req.params.pitchId);

  if (!tempPdf) {
    return res.status(404).json({ message: "Presentation not found" });
  }

  try {
    const { stdout } = await runProcess("pdfinfo", [tempPdf.pdfPath], 15000);
    const pagesMatch = stdout.match(/^Pages:\s+(\d+)/m);
    const pagesCount = Number(pagesMatch?.[1] ?? 0);

    if (!Number.isFinite(pagesCount) || pagesCount <= 0) {
      return res.status(500).json({ message: "Failed to read presentation pages" });
    }

    return res.json({
      fileName: tempPdf.fileName,
      pagesCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to read presentation metadata" });
  } finally {
    rm(tempPdf.workDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

// Renderiza una diapositiva como imagen para que el navegador la proyecte localmente.
pitchRouter.get("/public/:pitchId/presentation/page/:pageNumber.png", async (req, res) => {
  const pageNumber = Number(req.params.pageNumber);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return res.status(400).json({ message: "Invalid page number" });
  }

  const tempPdf = await writePresentationPdfToTempFile(req.params.pitchId);

  if (!tempPdf) {
    return res.status(404).json({ message: "Presentation not found" });
  }

  try {
    const outputPrefix = join(tempPdf.workDir, "slide");

    await runProcess(
      "pdftoppm",
      [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-singlefile",
        "-png",
        "-r",
        "180",
        tempPdf.pdfPath,
        outputPrefix,
      ],
      30000,
    );

    const pngBuffer = await readFile(`${outputPrefix}.png`);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pngBuffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to render presentation page" });
  } finally {
    rm(tempPdf.workDir, { recursive: true, force: true }).catch(() => undefined);
  }
});

// Devuelve el resumen detallado de un pitch para dashboard.
pitchRouter.get("/detail/:pitchId", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({
        message: "Pitch not found",
      });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `
      SELECT 
        p.id,
        p."eventId",
        p.name,
        p.description,
        p.color,
        p."logoUrl",
        p."presentationUrl",
        p."presentationFileName",
        COUNT(v.id)::int AS "votesCount",
        COALESCE(ROUND(AVG(v.innovation)::numeric, 2), 0) AS "innovationAvg",
        COALESCE(ROUND(AVG(v.viability)::numeric, 2), 0) AS "viabilityAvg",
        COALESCE(ROUND(AVG(v.impact)::numeric, 2), 0) AS "impactAvg",
        COALESCE(ROUND(AVG(v.presentation)::numeric, 2), 0) AS "presentationAvg"
      FROM pitch p
      LEFT JOIN vote v ON v."pitchId" = p.id
      WHERE p.id = $1
      GROUP BY
        p.id,
        p."eventId",
        p.name,
        p.description,
        p.color,
        p."logoUrl",
        p."presentationUrl",
        p."presentationFileName"
      `,
      [req.params.pitchId],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Pitch not found",

      })
    }

    return res.status(200).json(dashboardPitchDetailSchema.parse(presentPitchDetail(result.rows[0])))
  }catch(e) {
    console.error(e)
    return res.status(500).json({ message: "Failed to fetch pitch detail"})
  }
});

// Lista comentarios escritos en los votos del pitch.
pitchRouter.get("/comments", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  const pitchId = req.query.pitchId

  if (typeof pitchId !== "string" || pitchId.length === 0) {
    return res.status(400).json({ message: "pitchId is required"})
  }

  try {
    const eventId = await getEventIdForPitch(pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `SELECT
        v.id,
        v.comment,
        v."createdAt"
      FROM vote v
      WHERE v."pitchId" = $1
        AND v.comment IS NOT null
        AND TRIM(v.comment) <> ''
      ORDER BY v."createdAt" DESC
      `,
      [pitchId]
    );

    res.status(200).json(z.array(dashboardPitchCommentSchema).parse(result.rows.map(presentPitchComment)))
  } catch (error){
    console.log(error)
    res.status(500).json({ message: "Failed to fetch comments"})
  }
})

// Variables usadas para construir URLs publicas.
const env = validateServerEnv()

// Devuelve la URL publica del pitch para generar QR.
pitchRouter.get("/:pitchId/qr", async (req, res) => {
  const session = await requireSession(req, res)

  if(!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db.query(
      `SELECT
        p.id,
        p.name
      FROM pitch p
      WHERE p.id = $1
        `,
      [req.params.pitchId],
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" })
    }

    const pitch = result.rows[0]

    // Esta URL es la que luego se convierte en QR.
    const publicVoteUrl = `${env.FRONTEND_URL}/vote/${pitch.id}`;

    return res.json({
      id: pitch.id,
      name: pitch.name,
      publicVoteUrl,
    })
  } catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Failed to generate pitch access URL" })
  }
})

// Prepara los comentarios que luego podria resumir una IA.
pitchRouter.post("/:pitchId/summary", async (req, res) => {
  const session = await requireSession(req, res)

  if (!session) {
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const pitchResult = await db.query(
      `
      SELECT
        p.id,
        p.name
      FROM pitch p
      WHERE p.id = $1
        `,
        [req.params.pitchId],
    )

    if (pitchResult.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found" })
    }
    
    const commentsResult = await db.query(
      `
      SELECT
        v.id,
        v.comment,
        v."createdAt"
      FROM vote v
      WHERE v."pitchId" = $1
        AND v.comment IS NOT null
        AND TRIM(v.comment) <> ''
      ORDER by v."createdAt" DESC
      `,
      [req.params.pitchId],
    )

    const pitch = pitchResult.rows[0]
    const comments = commentsResult.rows;

    res.json(
      presentPitchSummary({ 
        pitchId: pitch.id,
        pitchName: pitch.name,
        commentsCount: comments.length,
        comments,
        summary: null,
        status: "PENDING_AI",
        message: "Comments collected successfully. AI summary not implemented yet"
      })
    )
  }catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Failed to prepare pitch summary"})
  }
})

// Exporta el reporte de un pitch en CSV.
pitchRouter.get("/:pitchId/export", async (req, res) => {
  const session = await requireSession(req, res)

  if (!session){
    return;
  }

  try {
    const eventId = await getEventIdForPitch(req.params.pitchId);

    if (!eventId) {
      return res.status(404).json({ message: "Pitch not found"});
    }

    const canManage = await canManageEvent(session.user.id, eventId);

    if (!canManage) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const detailResult = await db.query(
      `
        WITH pitch_stats AS (
          SELECT
            p.id,
            COUNT(v.id)::int AS "votesCount",
            COALESCE(ROUND(AVG(v.innovation)::numeric, 2), 0) AS "innovationAvg",
            COALESCE(ROUND(AVG(v.viability)::numeric, 2), 0) AS "viabilityAvg",
            COALESCE(ROUND(AVG(v.impact)::numeric, 2), 0) AS "impactAvg",
            COALESCE(ROUND(AVG(v.presentation)::numeric, 2), 0) AS "presentationAvg",
            ${buildWeightedScoreSql("v", "e.criteria")} AS "scoreAvg",
            ${buildCriteriaAveragesSql("p", "e.criteria")} AS "criteriaAverages"
          FROM pitch p
          INNER JOIN event e ON e.id = p."eventId"
          LEFT JOIN vote v ON v."pitchId" = p.id
          WHERE p.id = $1
          GROUP BY
            p.id,
            e.criteria
        )
        SELECT
          p.id,
          p.name,
          p.description,
          p.status,
          e.criteria,
          ps."votesCount",
          ps."innovationAvg",
          ps."viabilityAvg",
          ps."impactAvg",
          ps."presentationAvg",
          ps."scoreAvg",
          ps."criteriaAverages",
          v."evaluatorEmail",
          v."criteriaScores",
          v.innovation,
          v.viability,
          v.impact,
          v.presentation,
          v.comment
        FROM pitch p
        INNER JOIN event e ON e.id = p."eventId"
        INNER JOIN pitch_stats ps ON ps.id = p.id
        LEFT JOIN vote v ON v."pitchId" = p.id
        WHERE p.id = $1
        ORDER BY v."createdAt" ASC
      `,
    [req.params.pitchId]
    )

    if (detailResult.rowCount === 0) {
      return res.status(404).json({ message: "Pitch not found"})
    }

    const pitch = detailResult.rows[0];

    const escapeCsvValue = (value: string | number | null | undefined) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const eventCriteria = normalizeEventCriteria(pitch.criteria);

    const getVoteScore = (row: Record<string, unknown>, criterionId: string) => {
      const scores = Array.isArray(row.criteriaScores) ? row.criteriaScores : [];
      const scoreItem = scores.find(
        (item): item is { criterionId: string; score: number } =>
          typeof item === "object" &&
          item !== null &&
          "criterionId" in item &&
          "score" in item &&
          item.criterionId === criterionId,
      );

      if (scoreItem) {
        return Number(scoreItem.score);
      }

      const legacyScores = new Map<string, unknown>([
        ["innovation", row.innovation],
        ["viability", row.viability],
        ["impact", row.impact],
        ["presentation", row.presentation],
      ]);

      const score = legacyScores.get(criterionId);
      return score == null ? "" : Number(score);
    };

    const getAverageScore = (row: Record<string, unknown>, criterionId: string) => {
      const averages = Array.isArray(row.criteriaAverages) ? row.criteriaAverages : [];
      const averageItem = averages.find(
        (item): item is { id: string; avg: number } =>
          typeof item === "object" &&
          item !== null &&
          "id" in item &&
          "avg" in item &&
          item.id === criterionId,
      );

      if (averageItem) {
        return Number(averageItem.avg);
      }

      const legacyAverages = new Map<string, unknown>([
        ["innovation", row.innovationAvg],
        ["viability", row.viabilityAvg],
        ["impact", row.impactAvg],
        ["presentation", row.presentationAvg],
      ]);

      return Number(legacyAverages.get(criterionId) ?? 0);
    };

    const getVoteAverage = (row: Record<string, unknown>) => {
      const weightedTotal = eventCriteria.reduce((sum, criterion) => {
        const score = getVoteScore(row, criterion.id);
        return score === "" ? sum : sum + Number(score) * criterion.weight;
      }, 0);

      const totalWeight = eventCriteria.reduce((sum, criterion) => {
        const score = getVoteScore(row, criterion.id);
        return score === "" ? sum : sum + criterion.weight;
      }, 0);

      return totalWeight === 0 ? "" : Number((weightedTotal / totalWeight).toFixed(2));
    };

    const csvHeader = [
      "pitch",
      "email",
      "votos",
      "Total AVG",
      "porcentaje",
      "promedio",
      ...eventCriteria.map((criterion) => criterion.label),
      ...eventCriteria.map((criterion) => `${criterion.label} Promedio`),
      "Comentario",
      "descripcion",
    ]
      .map((value) => escapeCsvValue(value))
      .join(",")

    const csvRows = detailResult.rows.map((row) => {
      const voteAverage = getVoteAverage(row);

      return [
        escapeCsvValue(row.name),
        escapeCsvValue(row.evaluatorEmail),
        row.votesCount,
        escapeCsvValue(
          voteAverage === "" ? "" : `${(Number(voteAverage) * 20).toFixed(1)}%`,
        ),
        escapeCsvValue(`${(Number(row.scoreAvg) * 20).toFixed(1)}%`),
        row.scoreAvg,
        ...eventCriteria.map((criterion) => getVoteScore(row, criterion.id)),
        ...eventCriteria.map((criterion) => getAverageScore(row, criterion.id)),
        escapeCsvValue(row.comment),
        escapeCsvValue(row.description),
      ].join(",")
    })

    const csv = [csvHeader, ...csvRows].join("\n")

    const pitchName = String(pitch.name)
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "")
    
    // Indica al navegador que la respuesta es un CSV descargable.
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pitchName || "pitch"}-report.csv"`,
    );

    return res.status(200).send(csv)
  }catch(error){
    console.error(error)
    return res.status(500).json({ message: "Failed to export pitch report"})
  }
})
