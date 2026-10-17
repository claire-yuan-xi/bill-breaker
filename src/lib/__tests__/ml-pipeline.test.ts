import { describe, expect, it } from "vitest";
import { profileTerms } from "@/lib/ml/profile-terms";
import { rankSections, splitBillSections } from "@/lib/ml/sections";
import { checkClaims } from "@/lib/ml/claims-check";
import { EXAMPLE_PROFILE, EXAMPLE_RUN } from "@/lib/ml/notebook-run";

describe("profileTerms", () => {
  it("matches the notebook's terms for the example reader", () => {
    expect(profileTerms(EXAMPLE_PROFILE).join(", ")).toBe(
      "assistance, bureau of land management, climate, college, colorado, conservation, credit, education, employer, environment, group health plan, lands, loan, loans, low-income, national forest, part-time, pollution, poverty, public land, retail, school, student, tuition, university, wilderness, wildlife, young, youth",
    );
  });

  it("reads the site's en-dash chips like the notebook's hyphens", () => {
    expect(profileTerms({ age: "18–24" })).toEqual(["student", "young", "youth"]);
  });

  it("skips no/none answers", () => {
    expect(profileTerms({ military: "No", health: "None" })).toEqual([]);
  });
});

describe("rankSections", () => {
  const bill = [
    "SEC. 1. SHORT TITLE.",
    "This Act may be cited as the Test Act.",
    "SEC. 2. STUDENT LOANS.",
    "A student with loans from a college or university may defer tuition loan payments.",
    "SEC. 3. HIGHWAYS.",
    "Funds for highways.",
  ].join("\n");

  it("splits at SEC. headings", () => {
    expect(splitBillSections(bill).map((s) => s.section)).toEqual(["1", "2", "3"]);
    expect(splitBillSections(bill)[1].heading).toBe("STUDENT LOANS");
  });

  it("ranks the section that mentions the reader's terms", () => {
    const { ranked } = rankSections(bill, { work: "student" });
    expect(ranked[0].section).toBe("2");
    expect(ranked).toHaveLength(1);
  });
});

describe("checkClaims", () => {
  it("flags the invented healthcare-cost line from the notebook run", () => {
    const sources = [EXAMPLE_RUN.general, ...EXAMPLE_RUN.sections.map((s) => s.heading)];
    const report = checkClaims(
      EXAMPLE_RUN.personalized,
      sources,
      Object.values(EXAMPLE_PROFILE).join(" "),
    );
    const health = report.claims.find((c) => c.text.includes("healthcare costs"));
    expect(health?.flags).toContain("new-topic");
    const opinion = report.claims.find((c) => c.text.includes("benefits outweigh"));
    expect(opinion?.flags).toContain("opinion");
    const grounded = report.claims.find((c) => c.text.startsWith("Identify where marine debris"));
    expect(grounded?.flags ?? []).toEqual([]);
  });
});
