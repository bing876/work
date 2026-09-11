import { describe, expect, it } from "vitest";
import { MockWorkbenchClient } from "../client/mock-workbench-client";
import { projectConversations, stableIndex } from "./workbench-utils";

describe("workbench utilities", () => {
  it("filters conversations by title, preview, and agent metadata", async () => {
    const data = await new MockWorkbenchClient().bootstrap();
    expect(projectConversations(data, "春季")).toHaveLength(1);
    expect(projectConversations(data, "内容与渠道")).toHaveLength(1);
    expect(projectConversations(data, "不存在")).toHaveLength(0);
  });

  it("maps the same agent to a stable avatar slot", () => {
    expect(stableIndex("chen-mo", 6)).toBe(stableIndex("chen-mo", 6));
    expect(stableIndex("chen-mo", 6)).toBeGreaterThanOrEqual(0);
    expect(stableIndex("chen-mo", 6)).toBeLessThan(6);
  });
});
