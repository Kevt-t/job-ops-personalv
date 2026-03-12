import type { PipelineConfig } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProgress, resetProgress } from "../progress";
import { discoverJobsStep } from "./discover-jobs";

vi.mock("@server/repositories/settings", () => ({
  getAllSettings: vi.fn(),
}));

vi.mock("@server/repositories/jobs", () => ({
  getAllJobUrls: vi.fn().mockResolvedValue([]),
}));

vi.mock("@server/extractors/registry", () => ({
  getExtractorRegistry: vi.fn(),
}));

const baseConfig: PipelineConfig = {
  topN: 10,
  minSuitabilityScore: 50,
  sources: ["indeed", "linkedin"],
  outputDir: "./tmp",
  enableCrawling: true,
  enableScoring: true,
  enableImporting: true,
  enableAutoTailoring: true,
};

describe("discoverJobsStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProgress();
  });

  it("aggregates source errors for enabled sources", async () => {
    const settingsRepo = await import("@server/repositories/settings");
    const registryModule = await import("@server/extractors/registry");

    const jobspyManifest = {
      id: "jobspy",
      displayName: "JobSpy",
      providesSources: ["indeed", "linkedin", "glassdoor"],
      run: vi.fn().mockResolvedValue({
        success: true,
        jobs: [
          {
            source: "linkedin",
            title: "Engineer",
            employer: "ACME",
            jobUrl: "https://example.com/job",
          },
        ],
      }),
    };
    const adzunaManifest = {
      id: "adzuna",
      displayName: "Adzuna",
      providesSources: ["adzuna"],
      run: vi.fn().mockResolvedValue({
        success: false,
        jobs: [],
        error: "login failed",
      }),
    };

    vi.mocked(settingsRepo.getAllSettings).mockResolvedValue({
      searchTerms: JSON.stringify(["engineer"]),
    } as any);

    vi.mocked(registryModule.getExtractorRegistry).mockResolvedValue({
      manifests: new Map([
        ["jobspy", jobspyManifest as any],
        ["adzuna", adzunaManifest as any],
      ]),
      manifestBySource: new Map([
        ["indeed", jobspyManifest as any],
        ["linkedin", jobspyManifest as any],
        ["glassdoor", jobspyManifest as any],
        ["adzuna", adzunaManifest as any],
      ]),
      availableSources: ["indeed", "linkedin", "glassdoor", "adzuna"],
    } as any);

    const result = await discoverJobsStep({
      mergedConfig: { ...baseConfig, sources: ["indeed", "linkedin", "adzuna"] },
    });

    expect(result.discoveredJobs).toHaveLength(1);
    expect(result.sourceErrors).toEqual([
      "Adzuna: login failed (sources: adzuna)",
    ]);
    expect(jobspyManifest.run).toHaveBeenCalledWith(
      expect.objectContaining({ selectedSources: ["indeed", "linkedin"] }),
    );
  });

  it("throws when all enabled sources fail", async () => {
    const settingsRepo = await import("@server/repositories/settings");
    const registryModule = await import("@server/extractors/registry");

    const adzunaManifest = {
      id: "adzuna",
      displayName: "Adzuna",
      providesSources: ["adzuna"],
      run: vi.fn().mockResolvedValue({
        success: false,
        jobs: [],
        error: "boom",
      }),
    };

    vi.mocked(settingsRepo.getAllSettings).mockResolvedValue({
      searchTerms: JSON.stringify(["engineer"]),
    } as any);

    vi.mocked(registryModule.getExtractorRegistry).mockResolvedValue({
      manifests: new Map([["adzuna", adzunaManifest as any]]),
      manifestBySource: new Map([["adzuna", adzunaManifest as any]]),
      availableSources: ["adzuna"],
    } as any);

    await expect(
      discoverJobsStep({
        mergedConfig: {
          ...baseConfig,
          sources: ["adzuna"],
        },
      }),
    ).rejects.toThrow(
      "All sources failed: Adzuna: boom (sources: adzuna)",
    );
  });

  it("throws when all requested sources are incompatible for country", async () => {
    const settingsRepo = await import("@server/repositories/settings");
    const registryModule = await import("@server/extractors/registry");

    vi.mocked(settingsRepo.getAllSettings).mockResolvedValue({
      searchTerms: JSON.stringify(["engineer"]),
      jobspyCountryIndeed: "united states",
    } as any);

    vi.mocked(registryModule.getExtractorRegistry).mockResolvedValue({
      manifests: new Map(),
      manifestBySource: new Map(),
      availableSources: [],
    } as any);

    await expect(
      discoverJobsStep({
        mergedConfig: {
          ...baseConfig,
          sources: ["adzuna", "hiringcafe"],
        },
      }),
    ).rejects.toThrow(
      "No compatible sources for selected country: United States",
    );
  });

  it("does not throw when no sources are requested", async () => {
    const settingsRepo = await import("@server/repositories/settings");
    const registryModule = await import("@server/extractors/registry");

    vi.mocked(settingsRepo.getAllSettings).mockResolvedValue({
      searchTerms: JSON.stringify(["engineer"]),
      jobspyCountryIndeed: "united states",
    } as any);

    vi.mocked(registryModule.getExtractorRegistry).mockResolvedValue({
      manifests: new Map(),
      manifestBySource: new Map(),
      availableSources: [],
    } as any);

    const result = await discoverJobsStep({
      mergedConfig: {
        ...baseConfig,
        sources: [],
      },
    });

    expect(result.discoveredJobs).toEqual([]);
    expect(result.sourceErrors).toEqual([]);
  });

  it("drops discovered jobs when employer matches blocked company keywords", async () => {
    const settingsRepo = await import("@server/repositories/settings");
    const registryModule = await import("@server/extractors/registry");

    const jobspyManifest = {
      id: "jobspy",
      displayName: "JobSpy",
      providesSources: ["indeed", "linkedin", "glassdoor"],
      run: vi.fn().mockResolvedValue({
        success: true,
        jobs: [
          {
            source: "linkedin",
            title: "Engineer",
            employer: "Acme Staffing",
            jobUrl: "https://example.com/job-1",
          },
          {
            source: "linkedin",
            title: "Engineer II",
            employer: "Contoso",
            jobUrl: "https://example.com/job-2",
          },
        ],
      }),
    };

    vi.mocked(settingsRepo.getAllSettings).mockResolvedValue({
      searchTerms: JSON.stringify(["engineer"]),
      blockedCompanyKeywords: JSON.stringify(["recruit", "staffing"]),
    } as any);

    vi.mocked(registryModule.getExtractorRegistry).mockResolvedValue({
      manifests: new Map([["jobspy", jobspyManifest as any]]),
      manifestBySource: new Map([
        ["indeed", jobspyManifest as any],
        ["linkedin", jobspyManifest as any],
        ["glassdoor", jobspyManifest as any],
      ]),
      availableSources: ["indeed", "linkedin", "glassdoor"],
    } as any);

    const result = await discoverJobsStep({
      mergedConfig: {
        ...baseConfig,
        sources: ["linkedin"],
      },
    });

    expect(result.discoveredJobs).toHaveLength(1);
    expect(result.discoveredJobs[0]?.employer).toBe("Contoso");
  });

  it("tracks source completion counters across source transitions", async () => {
    const settingsRepo = await import("@server/repositories/settings");
    const jobsRepo = await import("@server/repositories/jobs");
    const registryModule = await import("@server/extractors/registry");

    const jobspyManifest = {
      id: "jobspy",
      displayName: "JobSpy",
      providesSources: ["indeed", "linkedin", "glassdoor"],
      run: vi.fn().mockResolvedValue({ success: true, jobs: [] }),
    };
    const adzunaManifest = {
      id: "adzuna",
      displayName: "Adzuna",
      providesSources: ["adzuna"],
      run: vi.fn().mockResolvedValue({ success: true, jobs: [] }),
    };

    vi.mocked(settingsRepo.getAllSettings).mockResolvedValue({
      searchTerms: JSON.stringify(["engineer"]),
    } as any);
    vi.mocked(jobsRepo.getAllJobUrls).mockResolvedValue([
      "https://example.com/existing",
    ]);

    vi.mocked(registryModule.getExtractorRegistry).mockResolvedValue({
      manifests: new Map([
        ["jobspy", jobspyManifest as any],
        ["adzuna", adzunaManifest as any],
      ]),
      manifestBySource: new Map([
        ["indeed", jobspyManifest as any],
        ["linkedin", jobspyManifest as any],
        ["glassdoor", jobspyManifest as any],
        ["adzuna", adzunaManifest as any],
      ]),
      availableSources: ["indeed", "linkedin", "glassdoor", "adzuna"],
    } as any);

    await discoverJobsStep({
      mergedConfig: {
        ...baseConfig,
        sources: ["linkedin", "adzuna"],
      },
    });

    const progress = getProgress();
    expect(progress.crawlingSourcesTotal).toBe(2);
    expect(progress.crawlingSourcesCompleted).toBe(2);
    expect(adzunaManifest.run).toHaveBeenCalledWith(
      expect.objectContaining({
        getExistingJobUrls: expect.any(Function),
      }),
    );

    const [{ getExistingJobUrls }] = adzunaManifest.run.mock.calls[0] as [
      { getExistingJobUrls: () => Promise<string[]> },
    ];
    await expect(getExistingJobUrls()).resolves.toEqual([
      "https://example.com/existing",
    ]);
  });
});
