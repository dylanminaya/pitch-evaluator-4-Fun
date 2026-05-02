import { z } from "zod";
import { eventCriterionSchema, type EventCriterion, type VoteCriterionScore } from "@workspace/shared/api";

export const defaultCriteria: EventCriterion[] = [
  { id: "innovation", label: "Innovacion", weight: 25, isDefault: true },
  { id: "viability", label: "Viabilidad", weight: 25, isDefault: true },
  { id: "impact", label: "Impacto", weight: 25, isDefault: true },
  { id: "presentation", label: "Presentacion", weight: 25, isDefault: true },
];

const criteriaSchema = z.array(eventCriterionSchema);

export function normalizeEventCriteria(value: unknown): EventCriterion[] {
  const parsed = criteriaSchema.safeParse(value);

  return parsed.success ? parsed.data : defaultCriteria;
}

export function validateCriteriaScores(
  criteriaScores: VoteCriterionScore[],
  eventCriteria: EventCriterion[],
): string | null {
  const expectedCriterionIds = new Set(eventCriteria.map((criterion) => criterion.id));
  const receivedCriterionIds = new Set(criteriaScores.map((criterion) => criterion.criterionId));

  if (expectedCriterionIds.size !== receivedCriterionIds.size) {
    return "Submitted scores must match the event criteria";
  }

  for (const criterionId of expectedCriterionIds) {
    if (!receivedCriterionIds.has(criterionId)) {
      return "Missing one or more required criteria scores";
    }
  }

  for (const criterionId of receivedCriterionIds) {
    if (!expectedCriterionIds.has(criterionId)) {
      return "Submitted scores include criteria that do not belong to this event";
    }
  }

  return null;
}

export const getScoreByCriterionId = (
  criteriaScores: VoteCriterionScore[],
  criterionId: string,
) => criteriaScores.find((item) => item.criterionId === criterionId)?.score ?? null;

const buildWeightLookupSql = (eventCriteriaAlias: string, criterionId: string, fallbackWeight: number) => `
  COALESCE(
    (
      SELECT (criterion_item->>'weight')::numeric
      FROM jsonb_array_elements(${eventCriteriaAlias}) criterion_item
      WHERE criterion_item->>'id' = '${criterionId}'
      LIMIT 1
    ),
    ${fallbackWeight}
  )
`;

export function buildWeightedScoreSql(voteAlias: string, eventCriteriaAlias: string) {
  const innovationWeightSql = buildWeightLookupSql(eventCriteriaAlias, "innovation", 25);
  const viabilityWeightSql = buildWeightLookupSql(eventCriteriaAlias, "viability", 25);
  const impactWeightSql = buildWeightLookupSql(eventCriteriaAlias, "impact", 25);
  const presentationWeightSql = buildWeightLookupSql(eventCriteriaAlias, "presentation", 25);

  return `
    COALESCE(
      ROUND(
        AVG(
          CASE
            WHEN jsonb_typeof(${voteAlias}."criteriaScores") = 'array'
              AND jsonb_array_length(${voteAlias}."criteriaScores") > 0
            THEN (
              SELECT
                SUM((score_item->>'score')::numeric * (criterion_item->>'weight')::numeric)
                / NULLIF(SUM((criterion_item->>'weight')::numeric), 0)
              FROM jsonb_array_elements(${voteAlias}."criteriaScores") score_item
              INNER JOIN jsonb_array_elements(${eventCriteriaAlias}) criterion_item
                ON criterion_item->>'id' = score_item->>'criterionId'
            )
            ELSE (
              (
                ${voteAlias}.innovation * ${innovationWeightSql} +
                ${voteAlias}.viability * ${viabilityWeightSql} +
                ${voteAlias}.impact * ${impactWeightSql} +
                ${voteAlias}.presentation * ${presentationWeightSql}
              ) / NULLIF(
                ${innovationWeightSql} +
                ${viabilityWeightSql} +
                ${impactWeightSql} +
                ${presentationWeightSql},
                0
              )
            )
          END
        )::numeric,
        2
      ),
      0
    )
  `;
}

export function buildCriteriaAveragesSql(pitchAlias: string, eventCriteriaAlias: string) {
  return `
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', criterion_item->>'id',
          'label', criterion_item->>'label',
          'weight', (criterion_item->>'weight')::int,
          'avg',
          COALESCE(
            (
              SELECT ROUND(AVG(
                CASE
                  WHEN jsonb_typeof(v2."criteriaScores") = 'array'
                    AND jsonb_array_length(v2."criteriaScores") > 0
                  THEN (
                    SELECT (score_item->>'score')::numeric
                    FROM jsonb_array_elements(v2."criteriaScores") score_item
                    WHERE score_item->>'criterionId' = criterion_item->>'id'
                    LIMIT 1
                  )
                  ELSE CASE criterion_item->>'id'
                    WHEN 'innovation' THEN v2.innovation::numeric
                    WHEN 'viability' THEN v2.viability::numeric
                    WHEN 'impact' THEN v2.impact::numeric
                    WHEN 'presentation' THEN v2.presentation::numeric
                    ELSE NULL
                  END
                END
              )::numeric, 2)
              FROM vote v2
              WHERE v2."pitchId" = ${pitchAlias}.id
            ),
            0
          )
        )
        ORDER BY criterion_order
      )
      FROM jsonb_array_elements(${eventCriteriaAlias}) WITH ORDINALITY AS criteria(criterion_item, criterion_order)
    )
  `;
}
