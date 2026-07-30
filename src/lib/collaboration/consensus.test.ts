import { describe, expect, it } from "vitest";
import { getMustQuotaState, summarizeConsensus } from "./consensus";

describe("collaboration consensus", () => {
  it("keeps consensus pending until every active member responds", () => {
    expect(summarizeConsensus([{ value: "must" }, { value: "okay" }], 4).label).toBe("pending");
  });

  it("labels unanimous support without no votes as popular", () => {
    expect(summarizeConsensus([{ value: "must" }, { value: "okay" }], 2).label).toBe("popular");
  });

  it("labels a completed vote with support and no votes as conflict", () => {
    expect(summarizeConsensus([{ value: "must" }, { value: "okay" }, { value: "no" }], 3).label).toBe("conflict");
  });

  it("labels a no-vote majority as skippable", () => {
    expect(summarizeConsensus([{ value: "okay" }, { value: "no" }, { value: "no" }], 3).label).toBe("skip");
  });

  it("tracks must quota without changing existing overage", () => {
    const reactions = [
      { userId: "u1", value: "must" as const },
      { userId: "u1", value: "must" as const },
      { userId: "u1", value: "must" as const },
    ];
    expect(getMustQuotaState(reactions, "u1", true, 2)).toMatchObject({ used: 3, remaining: 0, isOver: true, canAddMust: false });
  });
});
