# Documentacion: Validacion y Cuadros de Error

## Objetivo

El objetivo del cambio fue mejorar la experiencia del usuario cuando algo sale mal en los formularios y en las exportaciones.

Antes:

- algunos errores salian como texto tecnico
- otros errores no guiaban al usuario
- habia casos donde el frontend y el backend no validaban igual
- el usuario podia no entender que hizo mal

Despues:

- se muestra un cuadro visual reutilizable para errores o advertencias
- el mensaje explica que estuvo mal
- el mensaje tambien dice como corregirlo
- el cuadro de validacion no aparece al inicio, solo despues de intentar guardar y cuando hay error
- el error del servidor tambien se traduce a un mensaje mas amigable

---

## Archivos tocados

- [apps/web/components/feedback-panel.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/components/feedback-panel.tsx:1)
- [apps/web/lib/user-feedback.ts](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/lib/user-feedback.ts:1)
- [apps/web/app/events/new/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/new/page.tsx:1)
- [apps/web/app/events/[eventId]/pitches/new/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/%5BeventId%5D/pitches/new/page.tsx:1)
- [apps/web/app/events/[eventId]/pitches/[pitchId]/edit/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/%5BeventId%5D/pitches/%5BpitchId%5D/edit/page.tsx:1)
- [apps/web/app/events/[eventId]/exports/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/%5BeventId%5D/exports/page.tsx:1)
- [packages/shared/api/dashboard.ts](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/packages/shared/api/dashboard.ts:166)

---

## Parte 1: Componente reutilizable para mostrar mensajes

Archivo:
[apps/web/components/feedback-panel.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/components/feedback-panel.tsx:1)

### Codigo

```tsx
"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

export type FeedbackItem = {
  id: string;
  message: string;
  suggestion?: string;
};

type FeedbackPanelProps = {
  title: string;
  items: FeedbackItem[];
  tone?: "error" | "warning" | "info" | "success";
  className?: string;
};

const panelToneStyles = {
  error: {
    wrapper: "border-[#5a2433] bg-[#2a1018] text-[#ffd6df]",
    icon: "text-[#ff8cab]",
    suggestion: "text-[#ffb9c8]",
    Icon: AlertTriangle,
  },
  warning: {
    wrapper: "border-[#6a4b12] bg-[#251807] text-[#ffe0a8]",
    icon: "text-[#ffbf47]",
    suggestion: "text-[#ffd27d]",
    Icon: AlertTriangle,
  },
  info: {
    wrapper: "border-[#1f4767] bg-[#0f2234] text-[#d4ecff]",
    icon: "text-[#53b8ff]",
    suggestion: "text-[#9cd6ff]",
    Icon: Info,
  },
  success: {
    wrapper: "border-[#1b5536] bg-[#0f2418] text-[#cff8df]",
    icon: "text-[#83ce00]",
    suggestion: "text-[#b9f27b]",
    Icon: CheckCircle2,
  },
} as const;

export function FeedbackPanel({
  title,
  items,
  tone = "error",
  className,
}: FeedbackPanelProps) {
  if (!items.length) {
    return null;
  }

  const styles = panelToneStyles[tone];
  const Icon = styles.Icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-[0_10px_24px_rgba(2,8,23,0.18)]",
        styles.wrapper,
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl bg-black/10 px-3 py-2">
                <p className="text-sm leading-6">{item.message}</p>
                {item.suggestion ? (
                  <p className={cn("mt-1 text-xs leading-5", styles.suggestion)}>
                    Asi debes hacerlo: {item.suggestion}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Explicacion

Este componente fue creado para no repetir el mismo bloque visual en cada formulario.

### Por que se hizo asi

- `FeedbackItem` define una estructura unica para los mensajes
- `title` permite reutilizar el componente en varios contextos
- `items` permite mostrar uno o varios errores a la vez
- `tone` cambia el color y el icono segun el tipo de mensaje
- `if (!items.length) return null` fue clave para que no se vea nada si no hay errores
- `role="alert"` y `aria-live="polite"` ayudan a accesibilidad

### Idea principal

Separar la UI del error de la logica del error.

---

## Parte 2: Capa central de validacion amigable

Archivo:
[apps/web/lib/user-feedback.ts](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/lib/user-feedback.ts:1)

## 2.1 Helper para crear items

```ts
function createItem(
  id: string,
  message: string,
  suggestion?: string,
): FeedbackItem {
  return { id, message, suggestion };
}
```

### Por que existe

Para no repetir objetos manuales en todo el archivo y mantener un formato uniforme.

## 2.2 Validacion de color y URL

```ts
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
```

### Por que existe

- el color llega como texto y habia que asegurarse de que fuera un HEX valido
- la URL del logo es opcional, pero si se escribe algo debe ser correcta

## 2.3 Errores del formulario de pitch

```ts
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
```

### Por que se hizo asi

En vez de depender solo del backend, el frontend ahora puede detectar errores obvios antes de enviar.

### Beneficios

- menos peticiones innecesarias
- mensajes mas claros
- mejor experiencia

## 2.4 Errores del formulario de evento

```ts
export function getEventFormIssues(input: {
  name: string;
  description: string;
  criteria: EventCriterion[];
}) {
  const issues: FeedbackItem[] = [];

  if (input.name.trim().length < 3) {
    issues.push(createItem("event-name-min", "El nombre del evento es demasiado corto.", "Escribe al menos 3 caracteres, por ejemplo: Hackathon LATAM 2026."));
  }

  if (input.name.trim().length > 100) {
    issues.push(createItem("event-name-max", "El nombre del evento supera el limite permitido.", "Usa un nombre de 100 caracteres o menos."));
  }

  if (input.description.trim().length < 5) {
    issues.push(createItem("event-description-min", "La descripcion del evento es demasiado corta.", "Agrega una frase breve que explique el objetivo o el contexto del evento."));
  }

  if (input.description.trim().length > 500) {
    issues.push(createItem("event-description-max", "La descripcion del evento es demasiado larga.", "Reduce la descripcion a 500 caracteres o menos."));
  }

  if (input.criteria.length < 1) {
    issues.push(createItem("event-criteria-min", "No hay criterios suficientes para evaluar.", "Deja por lo menos 1 criterio activo."));
  }

  if (input.criteria.length > 6) {
    issues.push(createItem("event-criteria-max", "Hay demasiados criterios para este evento.", "Usa un maximo de 6 criterios."));
  }

  const totalWeight = input.criteria.reduce((sum, criterion) => sum + criterion.weight, 0);

  if (totalWeight !== 100) {
    issues.push(createItem("event-criteria-weight", `Los pesos de los criterios suman ${totalWeight}% y deben cerrar en 100%.`, "Ajusta los porcentajes hasta que el total sea exactamente 100%."));
  }

  const trimmedLabels = input.criteria.map((criterion) => criterion.label.trim());
  if (trimmedLabels.some((label) => label.length === 0)) {
    issues.push(createItem("event-criteria-label", "Hay criterios sin nombre.", "Escribe un nombre claro para cada criterio, por ejemplo: Innovacion o Viabilidad."));
  }

  const duplicateLabels = new Set<string>();
  trimmedLabels.forEach((label, index) => {
    if (!label) return;
    const normalized = label.toLowerCase();
    if (trimmedLabels.findIndex((item) => item.toLowerCase() === normalized) !== index) {
      duplicateLabels.add(label);
    }
  });

  if (duplicateLabels.size > 0) {
    issues.push(createItem("event-criteria-duplicate", "Hay criterios repetidos y eso puede confundir la votacion.", "Usa nombres distintos para cada criterio."));
  }

  return issues;
}
```

### Por que esta parte es importante

El formulario de evento es mas complejo porque no solo tiene campos simples. Tambien tiene estructura:

- cantidad minima y maxima de criterios
- pesos que deben sumar 100
- nombres no vacios
- nombres no duplicados

## 2.5 Traduccion de errores tecnicos a errores entendibles

```ts
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

  if (normalized.includes("invalid url")) {
    return [
      createItem(
        "friendly-url",
        "La URL enviada no es valida.",
        "Pega un enlace completo con http:// o https://, o deja el campo vacio.",
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

  return [
    createItem(
      "friendly-generic",
      rawMessage,
      "Verifica los datos y vuelve a intentarlo.",
    ),
  ];
}
```

### Por que se hizo

El backend y Zod devuelven mensajes tecnicos o en ingles. Esta funcion los interpreta y los convierte en mensajes utiles para el usuario final.

### Idea principal

Tener una capa de traduccion entre el error tecnico y la interfaz.

---

## Parte 3: Correccion de inconsistencia entre frontend y backend

Archivo:
[packages/shared/api/dashboard.ts](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/packages/shared/api/dashboard.ts:166)

### Codigo

```ts
export const createDashboardPitchSchema = z.object({
  eventId: z.string().min(1, "Event id is required"),
  name: z
    .string()
    .min(3, "Project name must have at least 3 characters")
    .max(25, "Project name cannot exceed 25 characters"),
  description: z
    .string()
    .min(5, "Project description must have at least 5 characters")
    .max(500, "Project description cannot exceed 500 characters"),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a valid hex code"),
  logoUrl: z.string().url().nullable().optional(),
});

export const updateDashboardPitchSchema = z.object({
  name: z
    .string()
    .min(3, "Project name must have at least 3 characters")
    .max(25, "Project name cannot exceed 25 characters"),
  description: z
    .string()
    .min(5, "Project description must have at least 5 characters")
    .max(500, "Project description cannot exceed 500 characters"),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6})$/, "Color must be a valid hex code"),
  logoUrl: z.string().url().nullable().optional(),
});
```

### Que estaba mal

Antes el frontend aceptaba hasta `150` caracteres en el nombre del pitch, pero el backend solo aceptaba `25`.

### Que problema causaba

El usuario podia escribir un nombre largo, el frontend lo aceptaba, pero luego el backend fallaba.

### Por que esta correccion era obligatoria

Si frontend y backend no validan igual, siempre aparecen errores raros.

---

## Parte 4: Integracion en Crear Pitch

Archivo:
[apps/web/app/events/[eventId]/pitches/new/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/%5BeventId%5D/pitches/new/page.tsx:13)

### Codigo clave

```tsx
const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
const formIssues = useMemo(
  () => getPitchFormIssues({ name, description, color, logoUrl }),
  [color, description, logoUrl, name],
);
const errorItems = error ? getFriendlyErrorItems(error) : [];
```

```tsx
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setHasTriedSubmit(true);

  if (formIssues.length > 0) {
    return;
  }

  const createdPitch = await mutateAsync({
    eventId,
    name,
    description,
    color,
    logoUrl: logoUrl.trim() || null,
  });

  router.push(
    `/dashboard?eventId=${createdPitch.eventId}&pitchId=${createdPitch.id}`,
  );
}
```

```tsx
<FeedbackPanel
  title="Revisa esto antes de guardar"
  items={hasTriedSubmit ? formIssues : []}
  tone="warning"
/>

<FeedbackPanel
  title="No pudimos guardar el pitch"
  items={errorItems}
  tone="error"
/>
```

### Explicacion

- `hasTriedSubmit` recuerda si el usuario ya intentó guardar
- `formIssues` calcula los problemas del formulario
- `errorItems` traduce errores del servidor
- si hay errores de formulario, se hace `return` y no se envia la peticion

### Por que se hizo asi

Porque querias exactamente esto:

- no mostrar nada al inicio
- solo mostrar el cuadro cuando de verdad haya error

Ese comportamiento se consigue con:

```tsx
items={hasTriedSubmit ? formIssues : []}
```

Si el usuario no ha intentado guardar, el array va vacio y el panel no se renderiza.

---

## Parte 5: Integracion en Editar Pitch

Archivo:
[apps/web/app/events/[eventId]/pitches/[pitchId]/edit/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/%5BeventId%5D/pitches/%5BpitchId%5D/edit/page.tsx:14)

### Codigo clave

```tsx
const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
const formIssues = useMemo(
  () => getPitchFormIssues({ name, description, color, logoUrl }),
  [color, description, logoUrl, name],
);
const errorItems = error ? getFriendlyErrorItems(error) : [];
```

```tsx
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setHasTriedSubmit(true);

  if (formIssues.length > 0) {
    return;
  }

  const updatedPitch = await mutateAsync({
    pitchId,
    data: {
      name,
      description,
      color,
      logoUrl: logoUrl.trim() || null,
    },
  });

  router.push(
    `/dashboard?eventId=${updatedPitch.eventId}&pitchId=${updatedPitch.id}`,
  );
}
```

```tsx
<FeedbackPanel
  title="Revisa esto antes de guardar"
  items={hasTriedSubmit ? formIssues : []}
  tone="warning"
/>

<FeedbackPanel
  title="No pudimos actualizar el pitch"
  items={errorItems}
  tone="error"
/>
```

### Por que se repite el mismo patron

Porque crear y editar tienen el mismo tipo de validacion.

### Ventaja

El usuario recibe una experiencia consistente.

---

## Parte 6: Integracion en Crear Evento

Archivo:
[apps/web/app/events/new/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/new/page.tsx:37)

### Codigo clave

```tsx
const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
const formIssues = useMemo(
  () => getEventFormIssues({ name, description, criteria }),
  [criteria, description, name],
);
const errorItems = error ? getFriendlyErrorItems(error) : [];
```

```tsx
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setHasTriedSubmit(true);

  if (
    totalWeight !== 100 ||
    !hasValidCriteriaCount ||
    name.trim().length < 3 ||
    description.trim().length < 5 ||
    formIssues.length > 0
  ) {
    return;
  }

  const createdEvent = await mutateAsync({
    name,
    description,
    criteria,
  });

  router.push(`/dashboard?eventId=${createdEvent.id}`);
}
```

```tsx
<FeedbackPanel
  title="Revisa esto antes de crear el evento"
  items={hasTriedSubmit ? formIssues : []}
  tone="warning"
/>

<FeedbackPanel
  title="No pudimos crear el evento"
  items={errorItems}
  tone="error"
/>
```

### Explicacion

Este formulario necesitaba una condicion mas fuerte porque tiene mas reglas:

- nombre
- descripcion
- numero de criterios
- pesos
- nombres de criterios

### Por que no se bloquea el boton desde el inicio

Antes el boton podia quedar deshabilitado silenciosamente. Ahora el usuario puede intentar guardar y ver por que no puede continuar.

Eso mejora mucho la UX.

---

## Parte 7: Integracion en Exportaciones

Archivo:
[apps/web/app/events/[eventId]/exports/page.tsx](/home/luis/Escritorio/proyecto%20de%20pitch/pitch-evaluator-4-Fun/apps/web/app/events/%5BeventId%5D/exports/page.tsx:58)

### Codigo clave

```tsx
const [exportError, setExportError] = useState<Error | null>(null);
```

```tsx
async function handleExportPitch(pitchId: string, pitchName: string) {
  try {
    setExportError(null);
    setIsExportingPitchId(pitchId);
    const blob = await exportPitch(pitchId);
    triggerBlobDownload(blob, `${createSlug(pitchName) || "pitch"}-report.csv`);
  } catch (error) {
    setExportError(
      error instanceof Error ? error : new Error("Failed to export pitch"),
    );
  } finally {
    setIsExportingPitchId(null);
  }
}
```

```tsx
<FeedbackPanel
  title="No pudimos generar el archivo"
  items={exportError ? getFriendlyErrorItems(exportError) : []}
  tone="error"
  className="mt-4"
/>
```

### Explicacion

Aqui no hay formulario como tal, pero si puede haber fallos al exportar.

### Que se hizo

- se agrego `exportError`
- se captura el error en `catch`
- se convierte a formato amigable
- se muestra solo cuando de verdad falla la exportacion

### Por que esta bien separado

Porque el error de exportacion es distinto del error de formulario.

---

## Flujo final del sistema

## Caso 1: El usuario abre la pantalla

- no se muestra el cuadro

## Caso 2: El usuario escribe mal y pulsa guardar

- `hasTriedSubmit` cambia a `true`
- se calculan errores con `getPitchFormIssues` o `getEventFormIssues`
- se muestra `FeedbackPanel`
- no se envia la peticion

## Caso 3: El formulario esta bien pero el servidor falla

- React Query pone `error`
- `getFriendlyErrorItems(error)` lo traduce
- `FeedbackPanel` muestra el error de servidor

## Caso 4: Todo sale bien

- no aparece ningun cuadro
- se navega al dashboard

---

## Decisiones tecnicas importantes

## 1. Validar en frontend y backend

No se debe confiar solo en frontend.

Frontend:

- mejora UX
- evita viajes inutiles al servidor

Backend:

- protege datos reales
- es la validacion definitiva

## 2. No renderizar si no hay items

```tsx
if (!items.length) {
  return null;
}
```

Esta linea hace que el componente no exista visualmente si no hay nada que mostrar.

## 3. Separar validacion y presentacion

- `user-feedback.ts` decide que mensaje mostrar
- `feedback-panel.tsx` decide como mostrarlo

Eso hace que el sistema escale mejor.

## 4. Usar `useMemo`

Se uso para no recalcular las validaciones sin necesidad en cada render.

---

## Problemas detectados durante el analisis

- mismatch entre frontend y backend en longitud del nombre del pitch
- errores tecnicos poco entendibles
- posibilidad de boton deshabilitado sin explicacion clara
- falta de consistencia visual entre formularios

---

## Verificacion realizada

Se corrio:

```bash
pnpm typecheck
```

Y paso correctamente.

---

## Temas para estudiar

- React `useState`
- React `useMemo`
- manejo de formularios en React
- validacion de datos en frontend
- validacion de datos en backend
- Zod
- manejo de errores en interfaces
- UX de formularios
- accesibilidad con `role="alert"` y `aria-live`
- TypeScript con tipos reutilizables
- patrones de separacion de responsabilidades
- React Query `useMutation`
- control de flujos `try/catch/finally`
- expresiones regulares basicas
- normalizacion de mensajes de error

---

## Resumen corto

Lo que se construyo fue una mini capa de UX para errores:

- detecta errores de entrada
- traduce errores tecnicos
- muestra mensajes claros
- solo aparece cuando realmente hace falta

Si quieres, el siguiente paso puede ser crear una segunda documentacion en `.md` solo con enfoque academico, como si fuera para estudiar para una entrevista o para explicarlo en clase.
