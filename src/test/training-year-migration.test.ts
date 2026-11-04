import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "drizzle/migrations/0005_training_year_classification.sql"),
  "utf8",
);

describe("training-year migration safety", () => {
  it("restricts classification reads and writes to administrators", () => {
    expect(migration).toMatch(
      /FOR SELECT TO authenticated\s+USING \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/,
    );
    expect(migration).toMatch(
      /FOR INSERT TO authenticated\s+WITH CHECK \(\s*public\.has_role\(auth\.uid\(\), 'admin'\)/,
    );
    expect(migration).toMatch(
      /FOR UPDATE TO authenticated\s+USING \(public\.has_role\(auth\.uid\(\), 'admin'\)\)/,
    );
  });

  it("allows only Years 1-4 and Unclassified, with no backfill or DELETE policy", () => {
    expect(migration).toContain("'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Unclassified'");
    expect(migration).toContain("No backfill");
    expect(migration).toContain("No DELETE policy");
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b/i);
    expect(migration).not.toMatch(/CREATE\s+POLICY[\s\S]*?FOR\s+DELETE/i);
  });

  it("updates updated_at through the existing shared trigger function", () => {
    expect(migration).toMatch(
      /BEFORE UPDATE ON public\.profile_training_classification[\s\S]*?EXECUTE FUNCTION public\.touch_updated_at\(\)/,
    );
  });
});
