import type { EventCriterion } from "@workspace/shared/api";
import type { FeedbackItem } from "@/components/feedback-panel";

function createItem(
  id: string,
  message: string,
  suggestion?: string,
): FeedbackItem {
  return { id, message, suggestion };
}

function isValidHexColor(value: string) {
  return /^#([A-F0-9]{6})$/i.test(value.trim());
}

function isValidOptionalUrl(value: string) {
  if (!value.trim()) {
    return true;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getPitchFormIssues(input: {
  name: string;
  description: string;
  color: string;
  logoUrl: string;
}) {
  const issues: FeedbackItem[] = [];

  if (input.name.trim().length < 3) {
    issues.push(
      createItem(
        "pitch-name-min",
        "El nombre del pitch es demasiado corto.",
        "Escribe al menos 3 caracteres, por ejemplo: EcoTrack AI.",
      ),
    );
  }

  if (input.name.trim().length > 25) {
    issues.push(
      createItem(
        "pitch-name-max",
        "El nombre del pitch es demasiado largo para guardarlo.",
        "Usa un nombre de 25 caracteres o menos.",
      ),
    );
  }

  if (input.description.trim().length < 5) {
    issues.push(
      createItem(
        "pitch-description-min",
        "La descripcion es demasiado corta.",
        "Explica el problema, la solucion o el valor del pitch en una frase completa.",
      ),
    );
  }

  if (input.description.trim().length > 500) {
    issues.push(
      createItem(
        "pitch-description-max",
        "La descripcion supera el limite permitido.",
        "Reduce la descripcion a 500 caracteres o menos.",
      ),
    );
  }

  if (!isValidHexColor(input.color)) {
    issues.push(
      createItem(
        "pitch-color",
        "El color no tiene un formato HEX valido.",
        "Usa un valor como #83CE00 o #0595F0.",
      ),
    );
  }

  if (!isValidOptionalUrl(input.logoUrl)) {
    issues.push(
      createItem(
        "pitch-logo-url",
        "La URL del logo no es valida.",
        "Pega un enlace completo que empiece con http:// o https://, o deja ese campo vacio.",
      ),
    );
  }

  return issues;
}

export function getEventFormIssues(input: {
  name: string;
  description: string;
  criteria: EventCriterion[];
}) {
  const issues: FeedbackItem[] = [];

  if (input.name.trim().length < 3) {
    issues.push(
      createItem(
        "event-name-min",
        "El nombre del evento es demasiado corto.",
        "Escribe al menos 3 caracteres, por ejemplo: Hackathon LATAM 2026.",
      ),
    );
  }

  if (input.name.trim().length > 100) {
    issues.push(
      createItem(
        "event-name-max",
        "El nombre del evento supera el limite permitido.",
        "Usa un nombre de 100 caracteres o menos.",
      ),
    );
  }

  if (input.description.trim().length < 5) {
    issues.push(
      createItem(
        "event-description-min",
        "La descripcion del evento es demasiado corta.",
        "Agrega una frase breve que explique el objetivo o el contexto del evento.",
      ),
    );
  }

  if (input.description.trim().length > 500) {
    issues.push(
      createItem(
        "event-description-max",
        "La descripcion del evento es demasiado larga.",
        "Reduce la descripcion a 500 caracteres o menos.",
      ),
    );
  }

  if (input.criteria.length < 2) {
    issues.push(
      createItem(
        "event-criteria-min",
        "No hay criterios suficientes para evaluar.",
        "Deja por lo menos 2 criterios activos.",
      ),
    );
  }

  if (input.criteria.length > 6) {
    issues.push(
      createItem(
        "event-criteria-max",
        "Hay demasiados criterios para este evento.",
        "Usa un maximo de 6 criterios.",
      ),
    );
  }

  const totalWeight = input.criteria.reduce(
    (sum, criterion) => sum + criterion.weight,
    0,
  );

  if (totalWeight !== 100) {
    issues.push(
      createItem(
        "event-criteria-weight",
        `Los pesos de los criterios suman ${totalWeight}% y deben cerrar en 100%.`,
        "Ajusta los porcentajes hasta que el total sea exactamente 100%.",
      ),
    );
  }

  const trimmedLabels = input.criteria.map((criterion) => criterion.label.trim());
  if (trimmedLabels.some((label) => label.length === 0)) {
    issues.push(
      createItem(
        "event-criteria-label",
        "Hay criterios sin nombre.",
        "Escribe un nombre claro para cada criterio, por ejemplo: Innovacion o Viabilidad.",
      ),
    );
  }

  const duplicateLabels = new Set<string>();
  trimmedLabels.forEach((label, index) => {
    if (!label) {
      return;
    }

    const normalized = label.toLowerCase();
    if (trimmedLabels.findIndex((item) => item.toLowerCase() === normalized) !== index) {
      duplicateLabels.add(label);
    }
  });

  if (duplicateLabels.size > 0) {
    issues.push(
      createItem(
        "event-criteria-duplicate",
        "Hay criterios repetidos y eso puede confundir la votacion.",
        "Usa nombres distintos para cada criterio.",
      ),
    );
  }

  return issues;
}

export function getFriendlyErrorItems(error: unknown): FeedbackItem[] {
  const rawMessage =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "No pudimos completar la accion.";
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("project name must have at least 3 characters")) {
    return [
      createItem(
        "friendly-pitch-name-min",
        "El nombre del pitch es demasiado corto.",
        "Escribe al menos 3 caracteres.",
      ),
    ];
  }

  if (normalized.includes("project name cannot exceed 25 characters")) {
    return [
      createItem(
        "friendly-pitch-name-max",
        "El nombre del pitch es demasiado largo.",
        "Reduce el nombre a 25 caracteres o menos.",
      ),
    ];
  }

  if (normalized.includes("project description must have at least 5 characters")) {
    return [
      createItem(
        "friendly-pitch-description-min",
        "La descripcion del pitch es demasiado corta.",
        "Agrega una frase con al menos 5 caracteres.",
      ),
    ];
  }

  if (normalized.includes("color must be a valid hex code")) {
    return [
      createItem(
        "friendly-color",
        "El color no tiene un formato valido.",
        "Usa un HEX de 6 digitos como #83CE00.",
      ),
    ];
  }

  if (normalized.includes("invalid url")) {
    return [
      createItem(
        "friendly-url",
        "La URL enviada no es valida.",
        "Pega un enlace completo con http:// o https://, o deja el campo vacio.",
      ),
    ];
  }

  if (normalized.includes("criteria weights must add up to 100%")) {
    return [
      createItem(
        "friendly-criteria-weight",
        "La configuracion de criterios no suma 100%.",
        "Ajusta los porcentajes hasta llegar exactamente a 100%.",
      ),
    ];
  }

  if (normalized.includes("forbidden")) {
    return [
      createItem(
        "friendly-forbidden",
        "Tu usuario no tiene permiso para hacer esto en este evento.",
        "Entra con un organizer autorizado o vuelve al evento correcto.",
      ),
    ];
  }

  if (normalized.includes("unauthorized")) {
    return [
      createItem(
        "friendly-unauthorized",
        "Tu sesion expiro o el navegador no envio la sesion al servidor.",
        "Inicia sesion de nuevo y vuelve a guardar el pitch.",
      ),
    ];
  }

  if (normalized.includes("failed to prepare presentation")) {
    return [
      createItem(
        "friendly-presentation-prepare",
        "No pudimos preparar el PowerPoint para proyectarlo.",
        "El pitch quedo guardado. Prueba subir de nuevo el .ppt o .pptx desde editar pitch.",
      ),
    ];
  }

  if (normalized.includes("only .ppt and .pptx")) {
    return [
      createItem(
        "friendly-presentation-format",
        "El archivo seleccionado no parece ser un PowerPoint valido.",
        "Sube un archivo con extension .ppt o .pptx.",
      ),
    ];
  }

  if (normalized.includes("not found")) {
    return [
      createItem(
        "friendly-not-found",
        "El recurso que intentaste usar ya no existe o cambió.",
        "Recarga la pagina y vuelve a intentarlo desde el dashboard.",
      ),
    ];
  }

  if (normalized.includes("failed to export")) {
    return [
      createItem(
        "friendly-export",
        "No pudimos generar la exportacion.",
        "Intenta de nuevo en unos segundos. Si sigue fallando, revisa que el evento tenga datos.",
      ),
    ];
  }

  if (normalized.includes("failed to create") || normalized.includes("failed to update")) {
    return [
      createItem(
        "friendly-save",
        "No pudimos guardar los cambios.",
        "Revisa los campos del formulario y vuelve a intentarlo.",
      ),
      createItem("friendly-save-detail", rawMessage),
    ];
  }

  if (normalized.includes("failed to fetch") || normalized.includes("request failed")) {
    return [
      createItem(
        "friendly-fetch",
        "No pudimos comunicarnos correctamente con el servidor.",
        "Recarga la pagina y verifica que el backend este disponible.",
      ),
      createItem("friendly-fetch-detail", rawMessage),
    ];
  }

  return [
    createItem(
      "friendly-generic",
      rawMessage,
      "Verifica los datos y vuelve a intentarlo.",
    ),
  ];
}
