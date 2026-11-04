export const TRAINING_YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Unclassified"] as const;

export type TrainingYear = (typeof TRAINING_YEARS)[number];

export function isTrainingYear(value: unknown): value is TrainingYear {
  return typeof value === "string" && TRAINING_YEARS.some((year) => year === value);
}

/** A missing row is displayed as Unclassified; this helper never writes/backfills. */
export function displayTrainingYear(value: unknown): TrainingYear {
  return isTrainingYear(value) ? value : "Unclassified";
}
