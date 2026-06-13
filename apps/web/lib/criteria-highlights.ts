import type { EventCriterion } from "@workspace/shared/api";

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
