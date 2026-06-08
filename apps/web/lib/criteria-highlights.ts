import type { EventCriterion } from "@workspace/shared/api";

export const topCriterionMarker = "🏆";

export function getTopWeightedCriterionIds(
  criteria: EventCriterion[],
  limit = 2,
) {
  return new Set(
    criteria
      .map((criterion, index) => ({ criterion, index }))
      .sort((left, right) => {
        if (right.criterion.weight !== left.criterion.weight) {
          return right.criterion.weight - left.criterion.weight;
        }

        return left.index - right.index;
      })
      .slice(0, limit)
      .map(({ criterion }) => criterion.id),
  );
}

export function formatCriterionLabel(
  criterion: EventCriterion,
  topCriterionIds: Set<string>,
) {
  return topCriterionIds.has(criterion.id)
    ? `${topCriterionMarker} ${criterion.label}`
    : criterion.label;
}
