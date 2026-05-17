// Shared types for OfferGlow resume profiles

export interface Metric {
  value: string;
  label: string;
}

export interface StructuredEntry {
  date: string;
  title: string;
  descriptions: string[];
  metrics?: Metric[];
}

export interface MasterProfile {
  name: string;
  headline: string;
  tagline: string;
  email: string;
  phone: string;
  summary: string[];
  tags: string[];
  top_metrics: Metric[];
  experiences: StructuredEntry[];
  projects: StructuredEntry[];
  educations: StructuredEntry[];
}

export interface ParseResult {
  profile: MasterProfile;
  aiStructured: boolean;
  source: {
    fileType: string;
    parser: "deepseek" | "local-rules";
    modelUsed: string;
  };
  debugError?: string;
}

export interface RewriteResult {
  companyName: string | null;
  instanceProfile: Partial<MasterProfile>;
  advantages: string[];
  gaps: { label: string; detail: string }[];
  anchorQuestions: string[];
  matchScore: number;
  qaNotice: string;
  aiRewritten: boolean;
}

export interface PublishResult {
  url: string;
  pageId: string;
}
