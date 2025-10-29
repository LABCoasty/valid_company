export interface Settings {
  apiBaseUrl: string;
  sheetId: string;
  sheetRange: string;
  aliasDomain: string;
  autofillEnabled: boolean;
  trustBadgeEnabled: boolean;
}

export interface ResumeExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ResumeEducation {
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
}

export interface Resume {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  linkedin: string;
  website: string;
  summary: string;
  experiences: ResumeExperience[];
  education: ResumeEducation[];
  skills: string[];
}

export interface TrustBreakdownEntry {
  label: string;
  score: number;
  weight: number;
  notes?: string;
}

export interface TrustScore {
  companyName: string;
  score: number | null;
  status: 'ok' | 'warning' | 'high-risk' | 'unverified' | 'unavailable';
  message: string;
  breakdown: TrustBreakdownEntry[];
  lastUpdated: string | null;
}

export interface AliasRecord {
  alias: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApplicationLog {
  companyName: string;
  jobTitle: string;
  jobUrl: string;
  jobLocation: string;
  submittedAt: string;
  aliasEmail: string;
  status: 'queued' | 'synced' | 'error';
  notes?: string;
}

export interface AutofillRequest {
  formId?: string;
  jobTitle: string;
  companyName: string;
  jobLocation?: string;
  fields?: Record<string, string>;
}

export interface AutofillPayload {
  resume: Resume;
  aliasEmail: string;
}

export interface TrustScoreRequest {
  companyName: string;
  jobTitle?: string;
  jobUrl?: string;
  jobLocation?: string;
}

export type BackgroundRequest =
  | { type: 'FETCH_TRUST_SCORE'; payload: TrustScoreRequest }
  | { type: 'REQUEST_AUTOFILL'; payload: AutofillRequest }
  | { type: 'LOG_APPLICATION'; payload: ApplicationLog }
  | { type: 'FLUSH_QUEUE' }
  | { type: 'GET_QUEUE_STATUS' }
  | { type: 'RESET_ALIAS'; payload: { companyName: string } };

export interface BackgroundResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
