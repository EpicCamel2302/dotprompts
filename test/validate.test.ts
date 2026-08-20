import { describe, expect, it } from "vitest";
import { ValidationError, validateRecord } from "../src/core/validate.js";
import { buildRecord } from "../src/core/record.js";

describe("validation", () => {
  it("accepts valid link-based records", () => {
    expect(() =>
      validateRecord({
        version: 1,
        id: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: "2026-08-20T11:00:00.000Z",
        model: "claude-4-sonnet",
        prompt: "Add retry logic",
        targets: [
          {
            path: "src/api/fetch.ts",
            links: [
              { type: "file" },
              {
                type: "region",
                startLine: 10,
                endLine: 20,
              },
              {
                type: "symbol",
                name: "fetchWithRetry",
                kind: "function",
              },
            ],
          },
        ],
      }),
    ).not.toThrow();
  });

  it("rejects path on links (path belongs on the target)", () => {
    expect(() =>
      validateRecord({
        version: 1,
        id: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: "2026-08-20T11:00:00.000Z",
        model: "test",
        prompt: "test",
        targets: [
          {
            path: "a.ts",
            links: [{ type: "file", path: "a.ts" }],
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects invalid record shape", () => {
    expect(() =>
      validateRecord({
        version: 1,
        id: "not-a-uuid",
        timestamp: "2026-08-20T11:00:00.000Z",
        model: "test",
        prompt: "test",
        targets: [],
      } as never),
    ).toThrow(ValidationError);
  });
});

describe("buildRecord", () => {
  it("builds valid records from input", () => {
    const built = buildRecord({
      model: "test",
      prompt: "do thing",
      targets: [
        {
          path: "a.ts",
          links: [{ type: "file" }],
        },
      ],
    });
    expect(built.version).toBe(1);
    expect(built.id).toBeTruthy();
  });
});
