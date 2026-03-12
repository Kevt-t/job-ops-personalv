import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { renderHookWithQueryClient } from "../test/renderWithQueryClient";
import { _resetSettingsCache, useSettings } from "./useSettings";

vi.mock("../api", () => ({
  getSettings: vi.fn(),
}));

describe("useSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetSettingsCache();
  });

  it("fetches settings on mount if not already cached", async () => {
    const mockSettings = { model: { value: "gpt-4", default: "gpt-4", override: null } };
    vi.mocked(api.getSettings).mockResolvedValue(mockSettings as any);

    const { result } = renderHookWithQueryClient(() => useSettings());

    // Should start in loading state
    expect(result.current.settings).toBeNull();

    await waitFor(() => {
      expect(result.current.settings).toEqual(mockSettings);
    });

    expect(api.getSettings).toHaveBeenCalledTimes(1);
  });

  it("uses default values when settings are null", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(null as any);

    const { result } = renderHookWithQueryClient(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).toBeNull();
    });
  });

  it("provides a refresh function that updates settings", async () => {
    const initialSettings = { model: { value: "gpt-4", default: "gpt-4", override: null } };
    const updatedSettings = { model: { value: "gpt-5", default: "gpt-4", override: "gpt-5" } };

    vi.mocked(api.getSettings).mockResolvedValueOnce(initialSettings as any);
    vi.mocked(api.getSettings).mockResolvedValueOnce(updatedSettings as any);

    const { result } = renderHookWithQueryClient(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings).toEqual(initialSettings);
    });

    let refreshed: any;
    await act(async () => {
      refreshed = await result.current.refreshSettings();
    });

    await waitFor(() => {
      expect(result.current.settings).toEqual(updatedSettings);
    });

    expect(refreshed).toEqual(updatedSettings);
  });

  it("handles errors when fetching settings", async () => {
    const mockError = new Error("Failed to fetch");
    vi.mocked(api.getSettings).mockRejectedValue(mockError);

    const { result } = renderHookWithQueryClient(() => useSettings());

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.settings).toBeNull();
  });
});
