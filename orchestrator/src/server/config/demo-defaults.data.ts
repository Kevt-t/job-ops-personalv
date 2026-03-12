import type { SettingKey } from "@server/repositories/settings";
import type {
  ApplicationStage,
  JobSource,
  JobStatus,
  ResumeProjectCatalogItem,
  StageEventMetadata,
} from "@shared/types";

export const DEMO_BASELINE_VERSION = "2026.02.05.v3";
export const DEMO_BASELINE_NAME = "Public Demo Baseline";

export type DemoDefaultSettings = Partial<Record<SettingKey, string>>;

export const DEMO_DEFAULT_SETTINGS: DemoDefaultSettings = {
  llmProvider: "openrouter",
  model: "google/gemini-3-flash-preview",
  searchTerms: JSON.stringify([
    "software engineer",
    "backend engineer",
    "full stack engineer",
  ]),
  backupEnabled: "0",
  backupHour: "2",
  backupMaxCount: "5",
  searchCities: "United States",
  jobspyResultsWanted: "25",
  jobspyCountryIndeed: "US",
  resumeProjects: JSON.stringify({
    maxProjects: 3,
    lockedProjectIds: ["demo-project-1"],
    aiSelectableProjectIds: [
      "demo-project-2",
      "demo-project-3",
      "demo-project-4",
      "demo-project-5",
    ],
  }),
};

export const DEMO_PROJECT_CATALOG: ResumeProjectCatalogItem[] = [
  {
    id: "demo-project-1",
    name: "Distributed Event Pipeline",
    description:
      "Built a Kafka + Node.js ingestion pipeline with replay, backfill, and SLA-based alerting.",
    date: "2025",
    isVisibleInBase: true,
  },
  {
    id: "demo-project-2",
    name: "ATS Workflow Automator",
    description:
      "Automated job ingestion, ranking, and status sync with retries and idempotent transitions.",
    date: "2024",
    isVisibleInBase: false,
  },
  {
    id: "demo-project-3",
    name: "Resume Tailoring Engine",
    description:
      "Generated role-specific summaries and skill emphasis from job requirements using typed prompts.",
    date: "2024",
    isVisibleInBase: false,
  },
  {
    id: "demo-project-4",
    name: "Observability Dashboard",
    description:
      "Implemented request tracing, structured logs, and SLO-driven dashboards for pipeline health.",
    date: "2023",
    isVisibleInBase: false,
  },
  {
    id: "demo-project-5",
    name: "Search Index Accelerator",
    description:
      "Shipped a fuzzy-match index with explainable scores and cached lookup acceleration.",
    date: "2023",
    isVisibleInBase: false,
  },
];

export interface DemoDefaultPipelineRun {
  id: string;
  status: "completed" | "failed";
  startedOffsetMinutes: number;
  completedOffsetMinutes: number;
  jobsDiscovered: number;
  jobsProcessed: number;
  errorMessage?: string;
}

export const DEMO_DEFAULT_PIPELINE_RUNS: DemoDefaultPipelineRun[] = [
  {
    id: "demo-run-1",
    status: "completed",
    startedOffsetMinutes: 2400,
    completedOffsetMinutes: 2360,
    jobsDiscovered: 38,
    jobsProcessed: 18,
  },
  {
    id: "demo-run-2",
    status: "completed",
    startedOffsetMinutes: 1920,
    completedOffsetMinutes: 1880,
    jobsDiscovered: 31,
    jobsProcessed: 16,
  },
  {
    id: "demo-run-3",
    status: "failed",
    startedOffsetMinutes: 1320,
    completedOffsetMinutes: 1290,
    jobsDiscovered: 12,
    jobsProcessed: 5,
    errorMessage: "Rate-limited by upstream source; resumed on next run.",
  },
  {
    id: "demo-run-4",
    status: "completed",
    startedOffsetMinutes: 780,
    completedOffsetMinutes: 740,
    jobsDiscovered: 29,
    jobsProcessed: 14,
  },
  {
    id: "demo-run-5",
    status: "completed",
    startedOffsetMinutes: 260,
    completedOffsetMinutes: 220,
    jobsDiscovered: 26,
    jobsProcessed: 11,
  },
];

export const COMPANY_PREFIXES = [
  "Acme",
  "Apex",
  "Arbor",
  "Atlas",
  "Aurora",
  "Beacon",
  "Bluebird",
  "Bright",
  "Cascade",
  "Cedar",
  "Cobalt",
  "Crescent",
  "Crown",
  "Crystal",
  "Delta",
  "Driftwood",
  "Eagle",
  "Element",
  "Evergreen",
  "Fable",
  "Falcon",
  "Fjord",
  "Forge",
  "Frontier",
  "Fusion",
  "Glacier",
  "Golden",
  "Granite",
  "Harbor",
  "Helix",
  "Horizon",
  "Indigo",
  "Ironwood",
  "Juniper",
  "Keystone",
  "Lighthouse",
  "Maple",
  "Meridian",
  "Monarch",
  "Mosaic",
  "Nimbus",
  "Northstar",
  "Nova",
  "Oakstone",
  "Onyx",
  "Orchard",
  "Orbit",
  "Palisade",
  "Pioneer",
  "Praxus",
  "Quantum",
  "Quarry",
  "Radiant",
  "Redwood",
  "Ridge",
  "Riverstone",
  "Saffron",
  "Sapphire",
  "Sequoia",
  "Silver",
  "Solstice",
  "Summit",
  "Sunstone",
  "Terra",
  "Timber",
  "Topaz",
  "Trident",
  "Unity",
  "Valley",
  "Vanguard",
  "Vertex",
  "Willow",
  "Windward",
  "Zenith",
] as const;

export const COMPANY_SUFFIXES = [
  "Labs",
  "Systems",
  "Technologies",
  "Solutions",
  "Group",
  "Holdings",
  "Partners",
  "Enterprises",
  "Industries",
  "Works",
  "Networks",
  "Dynamics",
  "Logistics",
  "Ventures",
  "Analytics",
  "Capital",
  "Software",
  "Consulting",
  "Research",
  "Manufacturing",
  "Energy",
  "Health",
  "Financial",
  "Media",
  "Security",
  "Foods",
  "Pharma",
  "Robotics",
  "Aerospace",
  "Telecom",
] as const;

export const DEMO_SOURCE_BASE_URLS: Record<JobSource, string> = {
  linkedin: "https://www.linkedin.com",
  indeed: "https://www.indeed.com",
  glassdoor: "https://www.glassdoor.com",
  adzuna: "https://www.adzuna.com",
  hiringcafe: "https://hiring.cafe",
  manual: "https://example.com",
};

export interface DemoDefaultJob {
  id: string;
  source: JobSource;
  title: string;
  employer: string;
  jobUrl: string;
  applicationLink: string;
  location: string;
  salary: string;
  deadline: string;
  jobDescription: string;
  status: JobStatus;
  discoveredOffsetMinutes: number;
  suitabilityScore: number;
  suitabilityReason: string;
  tailoredSummary?: string;
  tailoredHeadline?: string;
  tailoredSkills?: string[];
  selectedProjectIds?: string;
  pdfPath?: string;
  appliedOffsetMinutes?: number;
}

export const DEMO_BASE_JOBS: DemoDefaultJob[] = [
  {
    id: "demo-job-ready-1",
    source: "linkedin",
    title: "Software Engineer (Platform)",
    employer: "NovaStack",
    jobUrl: "https://www.linkedin.com",
    applicationLink: "https://www.linkedin.com",
    location: "Remote (US)",
    salary: "$130,000 - $155,000",
    deadline: "2026-03-15",
    jobDescription:
      "Build backend platform services for workflow orchestration, async job processing, and tenant-safe API integrations. You will own reliability patterns, improve queue throughput, and drive production observability.",
    status: "ready",
    discoveredOffsetMinutes: 1100,
    suitabilityScore: 84,
    suitabilityReason:
      "Strong fit for backend platform scope: direct overlap in TypeScript services, async orchestration, and production observability. Minor gap is deep Kubernetes networking, but overall impact/ownership expectations align well.",
    tailoredSummary:
      "Backend-focused engineer with a track record of shipping resilient TypeScript services, improving queue-driven processing latency, and hardening production systems with structured tracing and clear SLOs.",
    tailoredHeadline: "Software Engineer focused on platform reliability",
    tailoredSkills: ["TypeScript", "Node.js", "Kafka", "Observability"],
    selectedProjectIds: "demo-project-1,demo-project-4,demo-project-2",
    pdfPath: "/pdfs/demo-job-ready-1.pdf",
  },
  {
    id: "demo-job-ready-2",
    source: "indeed",
    title: "Backend Engineer (Integrations)",
    employer: "SignalForge",
    jobUrl: "https://www.indeed.com",
    applicationLink: "https://www.indeed.com",
    location: "Chicago, IL",
    salary: "$125,000 - $148,000",
    deadline: "2026-03-18",
    jobDescription:
      "Design integration services with strict API contracts, webhook safety, and robust retry semantics. Partner with product to convert integration requirements into maintainable service boundaries.",
    status: "ready",
    discoveredOffsetMinutes: 940,
    suitabilityScore: 82,
    suitabilityReason:
      "Good systems fit with strong contract discipline and webhook experience. Domain expectations around idempotent retries and payload sanitization match prior delivery history.",
    tailoredSummary:
      "Integration-minded backend engineer who builds reliable API surfaces, enforces request contracts, and protects systems with structured logging and redaction-first payload handling.",
    tailoredHeadline: "Backend Engineer for API and webhook integrations",
    tailoredSkills: ["API Design", "Webhooks", "Reliability", "TypeScript"],
    selectedProjectIds: "demo-project-2,demo-project-4,demo-project-5",
    pdfPath: "/pdfs/demo-job-ready-2.pdf",
  },
  {
    id: "demo-job-ready-3",
    source: "manual",
    title: "Senior Full-Stack Engineer",
    employer: "Northstar Health",
    jobUrl: "https://example.com",
    applicationLink: "https://example.com",
    location: "Remote (US)",
    salary: "$145,000 - $170,000",
    deadline: "2026-03-11",
    jobDescription:
      "Lead implementation of internal tools across React frontends and Node services. Improve operator workflows, reduce manual effort, and ship measurable productivity gains for operations teams.",
    status: "ready",
    discoveredOffsetMinutes: 760,
    suitabilityScore: 79,
    suitabilityReason:
      "Solid match on full-stack delivery and internal tooling outcomes. Strong evidence of reducing operational toil through productized workflows; moderate gap on healthcare domain specifics.",
    tailoredSummary:
      "Product-oriented full-stack engineer who translates operations pain points into maintainable React + Node workflows, with an emphasis on speed, clarity, and measurable automation impact.",
    tailoredHeadline: "Senior Full-Stack Engineer for internal platforms",
    tailoredSkills: ["React", "TypeScript", "UX Systems", "Node.js"],
    selectedProjectIds: "demo-project-2,demo-project-3,demo-project-4",
    pdfPath: "/pdfs/demo-job-ready-3.pdf",
  },
  {
    id: "demo-job-discovered-1",
    source: "indeed",
    title: "Backend Engineer",
    employer: "Acme Data Systems",
    jobUrl: "https://www.indeed.com",
    applicationLink: "https://www.indeed.com",
    location: "Austin, TX",
    salary: "$120,000 - $145,000",
    deadline: "2026-03-10",
    jobDescription:
      "Own backend APIs and data pipelines supporting analytics products. Work across schema evolution, endpoint performance, and production support rotations.",
    status: "discovered",
    discoveredOffsetMinutes: 640,
    suitabilityScore: 72,
    suitabilityReason:
      "Balanced fit for backend API ownership and data-heavy workloads. Meets core technical baseline; impact would improve with more recent analytics product depth.",
  },
  {
    id: "demo-job-discovered-3",
    source: "linkedin",
    title: "Platform Reliability Engineer",
    employer: "VectorScale",
    jobUrl: "https://www.linkedin.com",
    applicationLink: "https://www.linkedin.com",
    location: "Seattle, WA",
    salary: "$150,000 - $180,000",
    deadline: "2026-03-28",
    jobDescription:
      "Drive production reliability for customer-facing APIs. Build SLO dashboards, incident playbooks, and reliability automation to reduce mean time to recovery.",
    status: "discovered",
    discoveredOffsetMinutes: 300,
    suitabilityScore: 81,
    suitabilityReason:
      "Very strong reliability and observability alignment with clear evidence of incident response rigor and production hardening ownership.",
  },
  {
    id: "demo-job-applied-1",
    source: "manual",
    title: "Senior TypeScript Engineer",
    employer: "BrightScale",
    jobUrl: "https://example.com",
    applicationLink: "https://example.com",
    location: "New York, NY",
    salary: "$155,000 - $180,000",
    deadline: "2026-03-08",
    jobDescription:
      "Lead architecture of high-throughput TypeScript services powering customer automations. Mentor engineers and own service quality, incident response, and scalability planning.",
    status: "applied",
    discoveredOffsetMinutes: 5600,
    appliedOffsetMinutes: 5040,
    suitabilityScore: 88,
    suitabilityReason:
      "Excellent fit across senior ownership, service architecture, and TypeScript depth. Prior impact in scaling queue-backed systems directly matches role expectations.",
    tailoredSummary:
      "Senior backend engineer experienced in scaling TypeScript platforms, reducing failure rates through resilient service design, and mentoring teams through architecture-critical initiatives.",
    tailoredHeadline: "Senior TypeScript Engineer for scalable services",
    tailoredSkills: ["TypeScript", "Architecture", "Mentorship", "SRE"],
    selectedProjectIds: "demo-project-1,demo-project-4,demo-project-5",
    pdfPath: "/pdfs/demo-job-applied-1.pdf",
  },
  {
    id: "demo-job-applied-2",
    source: "linkedin",
    title: "Backend Engineer (Data Platform)",
    employer: "QuantaLedger",
    jobUrl: "https://www.linkedin.com",
    applicationLink: "https://www.linkedin.com",
    location: "Remote (US)",
    salary: "$140,000 - $165,000",
    deadline: "2026-03-06",
    jobDescription:
      "Develop core data platform capabilities: ingestion validation, metric freshness guarantees, and internal APIs for downstream analytics consumers.",
    status: "applied",
    discoveredOffsetMinutes: 4300,
    appliedOffsetMinutes: 3800,
    suitabilityScore: 86,
    suitabilityReason:
      "Strong fit for data-platform backend development with proven work in ingestion reliability and observable data flow guarantees.",
    tailoredSummary:
      "Backend engineer with practical data-pipeline ownership, focused on consistency checks, downstream contract safety, and production-grade diagnostics.",
    tailoredHeadline: "Backend Engineer for data reliability systems",
    tailoredSkills: ["Data Pipelines", "TypeScript", "SQL", "Observability"],
    selectedProjectIds: "demo-project-1,demo-project-2,demo-project-4",
    pdfPath: "/pdfs/demo-job-applied-2.pdf",
  },
  {
    id: "demo-job-applied-3",
    source: "indeed",
    title: "Staff Software Engineer",
    employer: "Harbor AI",
    jobUrl: "https://www.indeed.com",
    applicationLink: "https://www.indeed.com",
    location: "Boston, MA",
    salary: "$175,000 - $205,000",
    deadline: "2026-03-04",
    jobDescription:
      "Own technical strategy for workflow automation products. Set service boundaries, guide quality standards, and partner with product leadership on roadmap decomposition.",
    status: "applied",
    discoveredOffsetMinutes: 3200,
    appliedOffsetMinutes: 2600,
    suitabilityScore: 83,
    suitabilityReason:
      "Strong technical leadership overlap and systems design depth. Role is staff-level strategy heavy; profile demonstrates clear mentorship and architecture outcomes.",
    tailoredSummary:
      "Engineering lead with a record of defining service architecture, mentoring teams, and shipping workflow automation capabilities that improve throughput and reliability.",
    tailoredHeadline: "Staff engineer with architecture ownership",
    tailoredSkills: ["System Design", "Team Leadership", "TypeScript", "APIs"],
    selectedProjectIds: "demo-project-2,demo-project-4,demo-project-5",
    pdfPath: "/pdfs/demo-job-applied-3.pdf",
  },
  {
    id: "demo-job-skipped-2",
    source: "linkedin",
    title: "Junior Frontend Engineer",
    employer: "Pixelnest",
    jobUrl: "https://www.linkedin.com",
    applicationLink: "https://www.linkedin.com",
    location: "Remote (EU)",
    salary: "EUR 45,000",
    deadline: "2026-03-01",
    jobDescription:
      "Frontend-first role focused on marketing pages and design implementation.",
    status: "skipped",
    discoveredOffsetMinutes: 860,
    suitabilityScore: 58,
    suitabilityReason:
      "Deliberately skipped: role is frontend-heavy and below desired seniority target for this search profile.",
  },
];

export const DEMO_GENERATED_APPLIED_JOB_COUNT = 48;

export interface DemoDefaultStageEvent {
  id: string;
  applicationId: string;
  fromStage: ApplicationStage | null;
  toStage: ApplicationStage;
  title: string;
  occurredOffsetMinutes: number;
  metadata: StageEventMetadata | null;
}

export const DEMO_BASE_STAGE_EVENTS: DemoDefaultStageEvent[] = [
  {
    id: "demo-event-applied-1",
    applicationId: "demo-job-applied-1",
    fromStage: null,
    toStage: "applied",
    title: "Applied (seeded demo)",
    occurredOffsetMinutes: 180,
    metadata: { eventLabel: "Applied (seeded demo)", actor: "system" },
  },
  {
    id: "demo-event-screen-1",
    applicationId: "demo-job-applied-1",
    fromStage: "applied",
    toStage: "recruiter_screen",
    title: "Recruiter intro call",
    occurredOffsetMinutes: 4560,
    metadata: { eventLabel: "Recruiter Screen", actor: "user" },
  },
  {
    id: "demo-event-tech-1",
    applicationId: "demo-job-applied-1",
    fromStage: "recruiter_screen",
    toStage: "technical_interview",
    title: "Technical interview scheduled",
    occurredOffsetMinutes: 4200,
    metadata: { eventLabel: "Technical Interview", actor: "user" },
  },
  {
    id: "demo-event-applied-2",
    applicationId: "demo-job-applied-2",
    fromStage: null,
    toStage: "applied",
    title: "Applied via company portal",
    occurredOffsetMinutes: 3800,
    metadata: { eventLabel: "Applied", actor: "system" },
  },
  {
    id: "demo-event-assessment-2",
    applicationId: "demo-job-applied-2",
    fromStage: "applied",
    toStage: "assessment",
    title: "Take-home assessment sent",
    occurredOffsetMinutes: 3500,
    metadata: { eventLabel: "Assessment", actor: "user" },
  },
  {
    id: "demo-event-applied-3",
    applicationId: "demo-job-applied-3",
    fromStage: null,
    toStage: "applied",
    title: "Applied with tailored resume",
    occurredOffsetMinutes: 2600,
    metadata: { eventLabel: "Applied", actor: "system" },
  },
];
