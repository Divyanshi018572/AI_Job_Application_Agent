export interface LinksObject {
  linkedin?: string
  github?: string
  portfolio?: string
  twitter?: string
  other?: string
}

export interface WorkExperienceItem {
  id?: string
  company: string
  title: string
  duration?: string
  startDate?: string
  endDate?: string
  location?: string
  responsibilities: string[]
}

export interface EducationItem {
  id?: string
  institution: string
  degree: string
  field?: string
  duration?: string
  startDate?: string
  endDate?: string
}

export interface ProjectItem {
  id?: string
  name: string
  description?: string
  url?: string
  technologies?: string[]
}

export interface CertificationItem {
  id?: string
  name: string
  issuer?: string
  date?: string
  url?: string
}

export interface CareerPreferencesItem {
  targetLocations?: string[]
  preferredLocations?: string
  jobTypes?: string[]
  availability?: string
  noticePeriod?: string
  experienceLevel?: "Fresher" | "Experienced" | string
  expectedSalary?: string
}

/**
 * Top-level fields Gemini is asked to score for extraction confidence
 * (0.0–1.0). Scoped to top-level sections rather than every nested array
 * item — deep enough to flag "the model wasn't sure about your work
 * experience," not so granular the model can't fill it in reliably or the
 * UI can't render it sensibly.
 */
export const CONFIDENCE_FIELDS = [
  "profile.fullName",
  "profile.email",
  "profile.phone",
  "profile.location",
  "summary",
  "skills",
  "workExperience",
  "education",
  "projects",
  "certifications",
] as const

export type ConfidenceFieldKey = (typeof CONFIDENCE_FIELDS)[number]

export type FieldConfidenceMap = Partial<Record<ConfidenceFieldKey, number>>

export interface ParsedResume {
  profile: {
    fullName?: string
    email?: string
    phone?: string
    location?: string
    avatarUrl?: string
    links?: LinksObject
  }
  summary: string
  skills: string[]
  workExperience: WorkExperienceItem[]
  education: EducationItem[]
  projects?: ProjectItem[]
  certifications?: CertificationItem[]
  languages?: string[]
  achievements?: string[]
  careerPreferences?: CareerPreferencesItem
  /** Per-field extraction confidence, 0.0–1.0. See lib/resume/confidence.ts. */
  fieldConfidence?: FieldConfidenceMap
}

export interface ResumeRecord {
  id: string
  user_id: string
  file_name: string
  file_path: string
  file_url: string | null
  file_size: number
  content_type: string
  parsed_data: ParsedResume
  created_at: string
  updated_at: string
}
