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
  image?: string;
  imageData?: string;
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
  aboutTitle?: string;
  contactTitle?: string;
  experiences: StructuredEntry[];
  projects: StructuredEntry[];
  educations: StructuredEntry[];
  customSections?: CustomSection[];
  theme?: string;
  projectImages?: Record<number, string>;
  projectImageData?: Record<number, string>;
  // Editor-only fields (not persisted to published pages)
  heroImage?: string; // IndexedDB key for hero image
  heroImageData?: string; // Loaded base64 data URL (runtime only)
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

// Draft saved in localStorage (text only — images in IndexedDB)
export interface DraftPayload {
  id: string;
  profile: MasterProfile;
  savedAt: string;
  version: number;
}

// Draft list metadata (what dashboard shows)
export interface DraftMeta {
  id: string;
  name: string;
  updatedAt: string;
  status: "draft" | "published";
  publishedUrl?: string;
}

// Image references stored in profile (instead of base64 data)
export interface ImageRefs {
  heroImage?: string; // key into IndexedDB
  projectImages?: Record<number, string>; // index → key
}

export interface CustomBlock {
  id: string;
  type: "card" | "image";
  date?: string;
  title?: string;
  descriptions?: string[];
  image?: string;
  imageData?: string;
}

export interface CustomSection {
  id: string;
  tag: string;
  title: string;
  blocks: CustomBlock[];
}
