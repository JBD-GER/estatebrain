import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "@/lib/supabase/pagination";

describe("fetchAllRows", () => {
  it("loads every deterministic PostgREST range", async () => {
    const source = Array.from({ length: 2_205 }, (_, index) => ({
      id: index,
    }));
    const loader = vi.fn((from: number, to: number) =>
      Promise.resolve({
        data: source.slice(from, to + 1),
        error: null,
      }),
    );

    const result = await fetchAllRows(loader, { label: "Buchungen" });

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(source.length);
    expect(result.data?.at(-1)).toEqual({ id: 2_204 });
    expect(loader.mock.calls).toEqual([
      [0, 999],
      [1_000, 1_999],
      [2_000, 2_999],
    ]);
  });

  it("propagates a page error instead of returning a partial result", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce({
        data: Array.from({ length: 1_000 }, (_, id) => ({ id })),
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "network failed", code: "PGRST000" },
      });

    const result = await fetchAllRows(loader);

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      message: "network failed",
      code: "PGRST000",
    });
  });

  it("returns an explicit error when the safe row limit would truncate", async () => {
    const source = Array.from({ length: 2_001 }, (_, index) => ({
      id: index,
    }));

    const result = await fetchAllRows(
      (from, to) =>
        Promise.resolve({
          data: source.slice(from, to + 1),
          error: null,
        }),
      { pageSize: 1_000, maxRows: 2_000, label: "Nachrichten" },
    );

    expect(result.data).toBeNull();
    expect(result.error).toMatchObject({
      code: "ESTATE_BRAIN_RESULT_TOO_LARGE",
    });
  });

  it("accepts an exact maximum after probing one additional row", async () => {
    const source = Array.from({ length: 2_000 }, (_, index) => ({
      id: index,
    }));

    const result = await fetchAllRows(
      (from, to) =>
        Promise.resolve({
          data: source.slice(from, to + 1),
          error: null,
        }),
      { pageSize: 1_000, maxRows: 2_000 },
    );

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2_000);
  });
});
