import { z } from "zod";
import { eventCriterionSchema, type EventCriterion, type VoteCriterionScore } from "@workspace/shared/api";

export const defaultCriteria: EventCriterion[] = [
  { id: "innovation", label: "Innovación", weight: 25, isDefault: true },
  { id: "viability", label: "Viabilidad", weight: 25, isDefault: true },
  { id: "impact", label: "Impacto", weight: 25, isDefault: true },
  { id: "presentation", label: "Presentación", weight: 25, isDefault: true },
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

export const topCriterionMarker = "🏆";

export function getTrophyCriterionIds(criteria: EventCriterion[]) {
  const selectedCriteria = criteria.filter((criterion) => criterion.hasTrophy);

  if (selectedCriteria.length > 0) {
    return new Set(
      selectedCriteria.slice(0, 2).map((criterion) => criterion.id),
    );
  }

  return new Set(
    criteria
      .map((criterion, index) => ({ criterion, index }))
      .sort((left, right) => {
        if (right.criterion.weight !== left.criterion.weight) {
          return right.criterion.weight - left.criterion.weight;
        }

        return left.index - right.index;
      })
      .slice(0, 2)
      .map(({ criterion }) => criterion.id),
  );
}

export function formatCriterionLabel(
  criterion: EventCriterion,
  trophyCriterionIds: Set<string>,
) {
  return trophyCriterionIds.has(criterion.id)
    ? `${topCriterionMarker} ${criterion.label}`
    : criterion.label;
}

const buildLegacyAverageScoreSql = (voteAlias: string) => `
  (
    ${voteAlias}.innovation::numeric +
    ${voteAlias}.viability::numeric +
    ${voteAlias}.impact::numeric +
    ${voteAlias}.presentation::numeric
  ) / 4
`;

const buildLegacyScoreSql = (voteAlias: string, criterionIdSql: string) => `
  CASE ${criterionIdSql}
    WHEN 'innovation' THEN ${voteAlias}.innovation::numeric
    WHEN 'viability' THEN ${voteAlias}.viability::numeric
    WHEN 'impact' THEN ${voteAlias}.impact::numeric
    WHEN 'presentation' THEN ${voteAlias}.presentation::numeric
    ELSE ${buildLegacyAverageScoreSql(voteAlias)}
  END
`;

export function buildWeightedScoreSql(voteAlias: string, eventCriteriaAlias: string) {
  return `
    COALESCE(
      ROUND(
        AVG(
          (
            SELECT
              SUM(scored_criteria.score * scored_criteria.weight)
              / NULLIF(
                SUM(
                  CASE
                    WHEN scored_criteria.score IS NULL THEN 0
                    ELSE scored_criteria.weight
                  END
                ),
                0
              )
            FROM (
              SELECT
                (criterion_item->>'weight')::numeric AS weight,
                COALESCE(
                  (
                    SELECT (score_item->>'score')::numeric
                    FROM jsonb_array_elements(
                      CASE
                        WHEN jsonb_typeof(${voteAlias}."criteriaScores") = 'array'
                        THEN ${voteAlias}."criteriaScores"
                        ELSE '[]'::jsonb
                      END
                    ) score_item
                    WHERE score_item->>'criterionId' = criterion_item->>'id'
                    LIMIT 1
                  ),
                  ${buildLegacyScoreSql(voteAlias, "criterion_item->>'id'")}
                ) AS score
              FROM jsonb_array_elements(${eventCriteriaAlias}) criterion_item
            ) scored_criteria
          )
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
                  THEN COALESCE(
                    (
                      SELECT (score_item->>'score')::numeric
                      FROM jsonb_array_elements(v2."criteriaScores") score_item
                      WHERE score_item->>'criterionId' = criterion_item->>'id'
                      LIMIT 1
                    ),
                    ${buildLegacyScoreSql("v2", "criterion_item->>'id'")}
                  )
                  ELSE ${buildLegacyScoreSql("v2", "criterion_item->>'id'")}
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
