import { Router } from "express";
import express from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import JSZip from "jszip";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { XMLParser } from "fast-xml-parser";
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
  "application/pdf",
]);

const presentationUpload = express.raw({
  limit: "50mb",
  type: [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/pdf",
    "application/octet-stream",
  ],
});

type PreparedPresentation = {
  pdfBuffer: Buffer;
  pitchName: string;
  fileName: string;
};

type CachedPresentation = {
  fileName: string;
  pages: Map<number, Buffer>;
  pagesCount: number;
  version: number;
};

const presentationPreparationTasks = new Map<
  string,
  Promise<PreparedPresentation | null>
>();
const presentationCache = new Map<string, CachedPresentation>();
const presentationWarmupTasks = new Map<string, Promise<CachedPresentation | null>>();
const presentationVersions = new Map<string, number>();

const PATH_SEPARATOR = process.platform === "win32" ? ";" : ":";
const executablePathCache = new Map<string, string>();

async function resolveExecutablePath(command: string) {
  if (isAbsolute(command)) {
    await access(command, constants.X_OK);
    return command;
  }

  if (executablePathCache.has(command)) {
    return executablePathCache.get(command)!;
  }

  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const pathEnv = process.env.PATH ?? "";
  const searchPaths = pathEnv.split(PATH_SEPARATOR).filter(Boolean);

  for (const dir of searchPaths) {
    const candidatePath = join(dir, command);

    try {
      await access(candidatePath, constants.X_OK);
      executablePathCache.set(command, candidatePath);
      return candidatePath;
    } catch {
      // ignore missing candidates
    }
  }

  return null;
}

class MissingBinaryError extends Error {
  constructor(candidates: string[]) {
    super(
      `Required binary not found: ${candidates.join(", ")}. ` +
        `Install the required system package and make sure the executable is on PATH, or set the environment variable.`
    );
    this.name = "MissingBinaryError";
  }
}

type PresentationPdfMethod = "auto" | "libreoffice" | "purejs";

const PRESENTATION_PDF_METHOD: PresentationPdfMethod = (
  (process.env.PRESENTATION_PDF_METHOD ?? "auto").toLowerCase() as PresentationPdfMethod
);

async function resolveSystemCommand(envVarName: string, fallbackNames: string[]) {
  const candidates = [] as string[];

  if (process.env[envVarName]) {
    candidates.push(process.env[envVarName]!);
  }

  candidates.push(...fallbackNames);

  for (const candidate of candidates) {
    try {
      const path = await resolveExecutablePath(candidate);

      if (path) {
        return path;
      }
    } catch {
      // try next candidate
    }
  }

  throw new MissingBinaryError(candidates);
}

async function convertPresentationBufferToPdfWithLibreOffice(
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
    const libreofficeCommand = await resolveSystemCommand("LIBREOFFICE_BINARY", [
      "libreoffice",
      "soffice",
    ]);

    await runProcess(
      libreofficeCommand,
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

function extractTextFromNode(node: unknown): string[] {
  if (node == null) {
    return [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(extractTextFromNode);
  }

  if (typeof node !== "object") {
    return [];
  }

  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "a:t" && typeof value === "string") {
      return [value];
    }

    return extractTextFromNode(value);
  });
}

async function convertPptxBufferToPdfPureJs(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return aNum - bNum;
    });

  if (slidePaths.length === 0) {
    throw new Error("No slide files found in PPTX.");
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    ignoreDeclaration: true,
    parseTagValue: false,
  });

  for (const slidePath of slidePaths) {
    const file = zip.file(slidePath);

    if (!file) {
      continue;
    }

    const slideXml = await file.async("string");
    const slideJson = parser.parse(slideXml);
    const slideText = extractTextFromNode(slideJson).join("\n\n");

    const page = pdfDoc.addPage([1123.2, 794.88]);
    const { width, height } = page.getSize();
    const margin = 40;
    const fontSize = 18;
    const lineHeight = fontSize * 1.3;
    const wrappedText = slideText || "(Empty slide)";

    page.drawText(wrappedText, {
      x: margin,
      y: height - margin - fontSize,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: width - margin * 2,
      lineHeight,
    });
  }

  return Buffer.from(await pdfDoc.save());
}

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

  if (lowerFileName.endsWith(".pdf")) {
    return "application/pdf";
  }

  return null;
}

function getPresentationExtension(fileName: string, contentType: string) {
  const lowerFileName = fileName.toLowerCase();
  const lowerContentType = contentType.toLowerCase();

  if (lowerFileName.endsWith(".pdf") || lowerContentType === "application/pdf") {
    return "pdf";
  }

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
  const extension = getPresentationExtension(fileName, contentType);

  if (extension === "pdf") {
    return buffer;
  }

  if (PRESENTATION_PDF_METHOD === "purejs") {
    if (extension !== "pptx") {
      throw new Error(
        "Pure JS converter only supports .pptx files. Use LibreOffice for .ppt files."
      );
    }

    return convertPptxBufferToPdfPureJs(buffer);
  }

  if (PRESENTATION_PDF_METHOD === "libreoffice") {
    return convertPresentationBufferToPdfWithLibreOffice(buffer, fileName, contentType);
  }

  if (extension === "pptx") {
    try {
      return await convertPresentationBufferToPdfWithLibreOffice(buffer, fileName, contentType);
    } catch (error) {
      if (error instanceof MissingBinaryError) {
        return convertPptxBufferToPdfPureJs(buffer);
      }
      throw error;
    }
  }

  return convertPresentationBufferToPdfWithLibreOffice(buffer, fileName, contentType);
}

function getPresentationVersion(pitchId: string) {
  return presentationVersions.get(pitchId) ?? 0;
}

function bumpPresentationVersion(pitchId: string) {
  const nextVersion = getPresentationVersion(pitchId) + 1;
  presentationVersions.set(pitchId, nextVersion);
  presentationPreparationTasks.delete(pitchId);
  presentationWarmupTasks.delete(pitchId);
  presentationCache.delete(pitchId);
  return nextVersion;
}

async function getPdfPagesCount(pdfBuffer: Buffer) {
  const workDir = await mkdtemp(join(tmpdir(), "pitch-presentation-meta-"));
  const pdfPath = join(workDir, "presentation.pdf");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const pdfinfoCommand = await resolveSystemCommand("PDFINFO_BINARY", ["pdfinfo"]);
    const { stdout } = await runProcess(pdfinfoCommand, [pdfPath], 15000);
    const pagesMatch = stdout.match(/^Pages:\s+(\d+)/m);
    const pagesCount = Number(pagesMatch?.[1] ?? 0);

    if (!Number.isFinite(pagesCount) || pagesCount <= 0) {
      throw new Error("Failed to read presentation pages");
    }

    return pagesCount;
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function renderPresentationPage(pdfBuffer: Buffer, pageNumber: number) {
  const workDir = await mkdtemp(join(tmpdir(), "pitch-presentation-render-"));
  const pdfPath = join(workDir, "presentation.pdf");
  const outputPrefix = join(workDir, "slide");

  try {
    await writeFile(pdfPath, pdfBuffer);
    const pdftoppmCommand = await resolveSystemCommand("PDFTOPPM_BINARY", ["pdftoppm"]);

    await runProcess(
      pdftoppmCommand,
      [
        "-f",
        String(pageNumber),
        "-l",
        String(pageNumber),
        "-singlefile",
        "-png",
        "-r",
        "180",
        pdfPath,
        outputPrefix,
      ],
      30000,
    );

    return await readFile(`${outputPrefix}.png`);
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function preparePresentationPdf(pitchId: string): Promise<PreparedPresentation | null> {
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
  const presentationFile = row.presentationFile;
  const storedFileName = row.presentationFileName;
  const storedContentType = row.presentationContentType;
  const fileName = String(storedFileName ?? "presentation.pptx");
  const contentType =
    storedContentType ??
    getPowerPointContentType(fileName, undefined) ??
    "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  let pdfBuffer = row.presentationPdf;

  if (!pdfBuffer) {
    if (!presentationFile) {
      return null;
    }

    pdfBuffer = await convertPresentationBufferToPdf(
      presentationFile,
      fileName,
      contentType,
    );

    await db.query(
      `
        UPDATE pitch
        SET "presentationPdf" = $1
        WHERE
          id = $2
          AND "presentationFileName" IS NOT DISTINCT FROM $3
          AND "presentationContentType" IS NOT DISTINCT FROM $4
          AND "presentationFile" = $5
      `,
      [pdfBuffer, row.id, storedFileName, storedContentType, presentationFile],
    );
  }

  return {
    pdfBuffer,
    pitchName: String(row.name ?? "presentation"),
    fileName,
  };
}

function ensurePresentationPdf(pitchId: string) {
  const currentTask = presentationPreparationTasks.get(pitchId);

  if (currentTask) {
    return currentTask;
  }

  const task = preparePresentationPdf(pitchId).finally(() => {
    if (presentationPreparationTasks.get(pitchId) === task) {
      presentationPreparationTasks.delete(pitchId);
    }
  });

  presentationPreparationTasks.set(pitchId, task);
  return task;
}

async function renderRemainingPresentationPages(
  pitchId: string,
  version: number,
  pdfBuffer: Buffer,
  pages: Map<number, Buffer>,
  pagesCount: number,
) {
  for (let pageNumber = 2; pageNumber <= pagesCount; pageNumber += 1) {
    if (getPresentationVersion(pitchId) !== version) {
      return;
    }

    if (!pages.has(pageNumber)) {
      pages.set(
        pageNumber,
        await renderPresentationPage(pdfBuffer, pageNumber),
      );
    }
  }
}

async function warmPresentationCache(
  pitchId: string,
  version = getPresentationVersion(pitchId),
) {
  const cachedPresentation = presentationCache.get(pitchId);

  if (cachedPresentation?.version === version) {
    return cachedPresentation;
  }

  const currentTask = presentationWarmupTasks.get(pitchId);

  if (currentTask) {
    return currentTask;
  }

  const task = (async () => {
    const preparedPresentation = await ensurePresentationPdf(pitchId);

    if (!preparedPresentation || getPresentationVersion(pitchId) !== version) {
      return null;
    }

    const pagesCount = await getPdfPagesCount(preparedPresentation.pdfBuffer);

    if (getPresentationVersion(pitchId) !== version) {
      return null;
    }

    const pages = new Map<number, Buffer>();
    const cached: CachedPresentation = {
      fileName: preparedPresentation.fileName,
      pages,
      pagesCount,
      version,
    };

    presentationCache.set(pitchId, cached);

    pages.set(1, await renderPresentationPage(preparedPresentation.pdfBuffer, 1));

    void renderRemainingPresentationPages(
      pitchId,
      version,
      preparedPresentation.pdfBuffer,
      pages,
      pagesCount,
    ).catch((error) => {
      console.warn("Presentation pages could not be fully cached", error);
    });

    return cached;
  })().finally(() => {
    if (presentationWarmupTasks.get(pitchId) === task) {
      presentationWarmupTasks.delete(pitchId);
    }
  });

  presentationWarmupTasks.set(pitchId, task);
  return task;
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
        message: "Only .ppt, .pptx and .pdf presentation files are supported",
      });
    }

    const result = await db.query(
      `
        UPDATE pitch
        SET
          "presentationFileName" = $1,
          "presentationContentType" = $2,
          "presentationFile" = $3,
          "presentationPdf" = NULL,
          "presentationUrl" = NULL
        WHERE id = $4
        RETURNING id, "eventId", name, description, status, color, "logoUrl", "presentationUrl", "presentationFileName", "createdAt"
      `,
      [fileName, contentType, req.body, req.params.pitchId],
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.status(404).json({ message: "Pitch not found" });
    }

    const presentationVersion = bumpPresentationVersion(req.params.pitchId);
    void warmPresentationCache(req.params.pitchId, presentationVersion).catch((error) => {
      console.warn(
        "Presentation uploaded but could not be prepared yet. Ensure LibreOffice is installed or set LIBREOFFICE_BINARY.",
        error,
      );
    });

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
  try {
    const cachedPresentation = await warmPresentationCache(req.params.pitchId);

    if (!cachedPresentation) {
      return res.status(404).json({ message: "Presentation not found" });
    }

    return res.json({
      fileName: cachedPresentation.fileName,
      pagesCount: cachedPresentation.pagesCount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to read presentation metadata" });
  }
});

// Renderiza una diapositiva como imagen para que el navegador la proyecte localmente.
pitchRouter.get("/public/:pitchId/presentation/page/:pageNumber.png", async (req, res) => {
  const pageNumber = Number(req.params.pageNumber);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return res.status(400).json({ message: "Invalid page number" });
  }

  try {
    const version = getPresentationVersion(req.params.pitchId);
    let cachedPresentation = presentationCache.get(req.params.pitchId);

    if (cachedPresentation?.version !== version) {
      cachedPresentation = await warmPresentationCache(req.params.pitchId, version) ?? undefined;
    }

    if (!cachedPresentation) {
      return res.status(404).json({ message: "Presentation not found" });
    }

    if (pageNumber > cachedPresentation.pagesCount) {
      return res.status(404).json({ message: "Presentation page not found" });
    }

    let pngBuffer = cachedPresentation.pages.get(pageNumber);

    if (!pngBuffer) {
      const preparedPresentation = await ensurePresentationPdf(req.params.pitchId);

      if (!preparedPresentation) {
        return res.status(404).json({ message: "Presentation not found" });
      }

      pngBuffer = await renderPresentationPage(preparedPresentation.pdfBuffer, pageNumber);
      cachedPresentation.pages.set(pageNumber, pngBuffer);
    }

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(pngBuffer);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to render presentation page" });
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
