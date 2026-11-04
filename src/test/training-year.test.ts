import { describe, expect, it } from "vitest";
import { displayTrainingYear, isTrainingYear, TRAINING_YEARS } from "@/lib/training-year";

describe("manual training-year classification", () => {
  it("allows only years 1-4 and Unclassified", () => {
    expect(TRAINING_YEARS).toEqual(["Year 1", "Year 2", "Year 3", "Year 4", "Unclassified"]);
    expect(TRAINING_YEARS.every(isTrainingYear)).toBe(true);
    expect(isTrainingYear("Year 5")).toBe(false);
    expect(isTrainingYear(null)).toBe(false);
  });

  it("displays missing or invalid values as Unclassified without inferring a year", () => {
    expect(displayTrainingYear(undefined)).toBe("Unclassified");
    expect(displayTrainingYear("Unclassified")).toBe("Unclassified");
    expect(displayTrainingYear("Year 2")).toBe("Year 2");
    expect(displayTrainingYear("based on historic shifts")).toBe("Unclassified");
  });
});
