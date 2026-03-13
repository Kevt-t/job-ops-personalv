import { createAppSettings } from "@shared/testing/factories.js";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api";
import { useAuth } from "@client/hooks/useAuth";
import { useRole } from "../hooks/useRole";
import { renderWithQueryClient } from "../test/renderWithQueryClient";
import { SettingsPage } from "./SettingsPage";

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

const render = (ui: Parameters<typeof renderWithQueryClient>[0]) =>
  renderWithQueryClient(ui);

vi.mock("../api", () => ({
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  validateRxresume: vi.fn(),
  getRxResumeProjects: vi.fn(),
  authListCoaches: vi.fn().mockResolvedValue({ coaches: [] }),
  authCreateCoach: vi.fn(),
  authDeleteCoach: vi.fn(),
  clearDatabase: vi.fn(),
  deleteJobsByStatus: vi.fn(),
  getBackups: vi.fn().mockResolvedValue({ backups: [], nextScheduled: null }),
  createManualBackup: vi.fn(),
  deleteBackup: vi.fn(),
}));

vi.mock("../hooks/useRole", () => ({
  useRole: vi.fn(),
}));

vi.mock("@client/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const baseSettings = createAppSettings({
  profileProjects: [
    {
      id: "proj-1",
      name: "Project One",
      description: "Desc 1",
      date: "2024",
      isVisibleInBase: true,
    },
    {
      id: "proj-2",
      name: "Project Two",
      description: "Desc 2",
      date: "2023",
      isVisibleInBase: false,
    },
  ],
});

const renderPage = () => {
  return render(
    <MemoryRouter initialEntries={["/settings"]}>
      <SettingsPage />
    </MemoryRouter>,
  );
};

const openModelSection = async () => {
  const modelTrigger = await screen.findByRole("button", { name: /^model$/i });
  fireEvent.click(modelTrigger);
};

const openWritingStyleSection = async () => {
  const chatTrigger = await screen.findByRole("button", {
    name: /writing style & language/i,
  });
  fireEvent.click(chatTrigger);
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "owner-id", username: "owner", role: "user" },
      role: "user",
      isAuthenticated: true,
      isLoading: false,
      needsSetup: false,
      authRequired: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
    vi.mocked(useRole).mockReturnValue({
      role: "user",
      isCoach: false,
      canMutate: true,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.mocked(api.validateRxresume).mockResolvedValue({
      valid: false,
      message: "Missing credentials",
    });
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: originalScrollIntoView,
    });
  });

  it("saves trimmed model overrides", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    vi.mocked(api.updateSettings).mockResolvedValue({
      ...baseSettings,
      model: {
        value: "gpt-4",
        default: baseSettings.model.default,
        override: "gpt-4",
      },
    });

    renderPage();
    await openModelSection();

    const modelInput = screen.getByLabelText(/default model/i);
    await waitFor(() => expect(modelInput).toBeEnabled());
    fireEvent.change(modelInput, { target: { value: "  gpt-4  " } });

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    await waitFor(() => expect(saveButton).toBeEnabled());

    fireEvent.click(saveButton);

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
    expect(api.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Settings saved");
  });

  it("shows validation error for too long model override", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);

    renderPage();
    await openModelSection();

    const modelInput = screen.getByLabelText(/default model/i);
    await waitFor(() => expect(modelInput).toBeEnabled());
    fireEvent.change(modelInput, { target: { value: "a".repeat(201) } });

    expect(
      await screen.findByText(
        /String must contain at most 200 character\(s\)/i,
      ),
    ).toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect(saveButton).toBeDisabled();
  });

  it("clears jobs by status and summarizes results", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    vi.mocked(api.deleteJobsByStatus).mockResolvedValue({
      message: "",
      count: 2,
    });

    renderPage();

    const dangerTrigger = await screen.findByRole("button", {
      name: /danger zone/i,
    });
    fireEvent.click(dangerTrigger);

    const clearSelectedButton = await screen.findByRole("button", {
      name: /clear selected/i,
    });
    fireEvent.click(clearSelectedButton);

    const confirmButton = await screen.findByRole("button", {
      name: /clear 1 status/i,
    });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(api.deleteJobsByStatus).toHaveBeenCalledWith("discovered"),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Jobs cleared",
      expect.objectContaining({
        description: "Deleted 2 jobs: 2 discovered",
      }),
    );
  });

  it("enables save button when model is changed", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    renderPage();
    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect(saveButton).toBeDisabled();
    await openModelSection();

    const modelInput = screen.getByLabelText(/default model/i);
    await waitFor(() => expect(modelInput).toBeEnabled());

    fireEvent.change(modelInput, { target: { value: "new-model" } });
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it("hides pipeline tuning sections that moved to run modal", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    renderPage();

    await screen.findByRole("button", { name: /model/i });
    expect(
      screen.queryByRole("button", { name: /search terms/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /jobspy scraper/i }),
    ).not.toBeInTheDocument();
  });

  it("does not show the old basic auth controls", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    renderPage();

    const envTrigger = await screen.findByRole("button", {
      name: /environment & accounts/i,
    });
    fireEvent.click(envTrigger);

    expect(
      screen.queryByLabelText(/enable basic authentication/i),
    ).not.toBeInTheDocument();
  });

  it("shows coach account management for the owner role", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    renderPage();

    expect(
      await screen.findByRole("button", { name: /coach accounts/i }),
    ).toBeInTheDocument();
  });

  it("saves the writing language mode through the settings page", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    vi.mocked(api.updateSettings).mockResolvedValue(
      createAppSettings({
        chatStyleLanguageMode: {
          value: "match-resume",
          default: "manual",
          override: "match-resume",
        },
      }),
    );

    renderPage();
    await openWritingStyleSection();

    fireEvent.click(screen.getByRole("combobox", { name: /output language/i }));
    fireEvent.click(await screen.findByText("Match current resume language"));

    expect(
      screen.queryByRole("combobox", { name: /specific language/i }),
    ).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
    expect(api.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        chatStyleLanguageMode: "match-resume",
        chatStyleManualLanguage: null,
      }),
    );
  });

  it("hides coach management and keeps settings read-only for coaches", async () => {
    vi.mocked(useRole).mockReturnValue({
      role: "coach",
      isCoach: true,
      canMutate: false,
    });
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);

    renderPage();
    await openModelSection();

    const modelInput = screen.getByLabelText(/default model/i);
    await waitFor(() => expect(modelInput).toBeDisabled());
    expect(
      screen.queryByRole("button", { name: /coach accounts/i }),
    ).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    expect(saveButton).toBeDisabled();
  });

  it("saves blocked company keywords from scoring settings", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    vi.mocked(api.updateSettings).mockResolvedValue({
      ...baseSettings,
      blockedCompanyKeywords: {
        value: ["staffing"],
        default: [],
        override: ["staffing"],
      },
    });

    renderPage();

    const scoringTrigger = await screen.findByRole("button", {
      name: /scoring settings/i,
    });
    fireEvent.click(scoringTrigger);

    const input = screen.getByPlaceholderText('e.g. "recruitment", "staffing"');
    fireEvent.change(input, { target: { value: "staffing" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
    expect(api.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        blockedCompanyKeywords: ["staffing"],
      }),
    );
  });

  it("saves scoring instructions from scoring settings", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(baseSettings);
    vi.mocked(api.updateSettings).mockResolvedValue({
      ...baseSettings,
      scoringInstructions: {
        value:
          "Open to relocating, so do not mark down for location discrepancies.",
        default: "",
        override:
          "Open to relocating, so do not mark down for location discrepancies.",
      },
    });

    renderPage();

    const scoringTrigger = await screen.findByRole("button", {
      name: /scoring settings/i,
    });
    fireEvent.click(scoringTrigger);

    const textarea = screen.getByLabelText(/scoring instructions/i);
    fireEvent.change(textarea, {
      target: {
        value:
          "Open to relocating, so do not mark down for location discrepancies.",
      },
    });

    const saveButton = screen.getByRole("button", { name: /^save$/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
    expect(api.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        scoringInstructions:
          "Open to relocating, so do not mark down for location discrepancies.",
      }),
    );
  });
});
