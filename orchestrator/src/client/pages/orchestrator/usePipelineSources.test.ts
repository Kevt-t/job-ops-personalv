import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { PIPELINE_SOURCES_STORAGE_KEY } from "./constants";
import { usePipelineSources } from "./usePipelineSources";

function ensureStorage(): Storage {
  const existing = globalThis.localStorage as Partial<Storage> | undefined;
  const hasStorageShape =
    existing &&
    typeof existing.getItem === "function" &&
    typeof existing.setItem === "function" &&
    typeof existing.removeItem === "function" &&
    typeof existing.clear === "function";

  if (hasStorageShape) {
    return existing as Storage;
  }

  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      const value = store.get(key);
      return value ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });

  return storage;
}

describe("usePipelineSources", () => {
  beforeEach(() => {
    ensureStorage().clear();
  });

  it("filters stored sources to enabled sources", () => {
    ensureStorage().setItem(
      PIPELINE_SOURCES_STORAGE_KEY,
      JSON.stringify(["linkedin", "indeed"]),
    );

    const enabledSources = ["linkedin"] as const;

    const { result } = renderHook(() => usePipelineSources(enabledSources));

    expect(result.current.pipelineSources).toEqual(["linkedin"]);
  });

  it("falls back to the first enabled source", () => {
    ensureStorage().setItem(
      PIPELINE_SOURCES_STORAGE_KEY,
      JSON.stringify(["indeed"]),
    );

    const enabledSources = ["indeed", "linkedin"] as const;

    const { result } = renderHook(() => usePipelineSources(enabledSources));

    expect(result.current.pipelineSources).toEqual(["indeed"]);
  });

  it("ignores toggles for disabled sources", () => {
    ensureStorage().setItem(
      PIPELINE_SOURCES_STORAGE_KEY,
      JSON.stringify(["linkedin"]),
    );

    const enabledSources = ["linkedin"] as const;

    const { result } = renderHook(() => usePipelineSources(enabledSources));

    act(() => {
      result.current.toggleSource("indeed", true);
    });

    expect(result.current.pipelineSources).toEqual(["linkedin"]);
  });
});
