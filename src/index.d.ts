// Type definitions for @medintell/sdk

export interface MedIntellOptions {
  /** Your API key, e.g. `mi_live_...`. */
  apiKey: string;
  /** Base URL. Defaults to https://api.medintell.co */
  baseUrl?: string;
  /** Per-request timeout in ms (default 30000). */
  timeout?: number;
  /** Max automatic retries for 429/5xx/network errors (default 2). */
  maxRetries?: number;
}

export class MedIntellError extends Error {
  status?: number;
  code?: string;
  type?: string;
  requestId?: string;
}

export type Json = Record<string, any>;

export interface Page<T = Json> {
  data: T[];
  hasMore?: boolean;
  nextCursor?: string | null;
  total?: number;
}

declare class Resource {
  iterate(query?: Json): AsyncIterableIterator<Json>;
}

export declare class MedIntell {
  constructor(opts: MedIntellOptions);

  health(): Promise<Json>;

  organizations: {
    list(): Promise<Json[]>;
    retrieve(orgId: string): Promise<Json>;
  } & Resource;

  facilities: {
    list(): Promise<Json[]>;
    create(body: { orgId: string; name: string; location?: string }): Promise<Json>;
  } & Resource;

  departments: {
    list(query?: Json): Promise<Page>;
    retrieve(id: string): Promise<Json>;
    create(body: { name: string; facilityId: string }, idempotencyKey?: string): Promise<Json>;
    update(id: string, body: Json): Promise<Json>;
    kpis(query?: Json): Promise<Json>;
  } & Resource;

  doctors: {
    list(query?: Json): Promise<Page>;
    retrieve(id: string): Promise<Json>;
    create(body: { name: string; facilityId: string; departmentId?: string }, idempotencyKey?: string): Promise<Json>;
    update(id: string, body: Json): Promise<Json>;
    kpis(query?: Json): Promise<Json>;
  } & Resource;

  payers: {
    list(query?: Json): Promise<Page>;
    retrieve(payerId: string): Promise<Json>;
    create(body: { name: string }, idempotencyKey?: string): Promise<Json>;
    update(payerId: string, body: Json): Promise<Json>;
  } & Resource;

  patients: {
    list(query?: Json): Promise<Page>;
    retrieve(id: string): Promise<Json>;
    create(body: Json, idempotencyKey?: string | { idempotencyKey?: string }): Promise<Json>;
    update(id: string, body: Json): Promise<Json>;
    screeningEligibility(id: string): Promise<Json>;
    screeningMatches(id: string): Promise<Json>;
    vbcEligibility(id: string): Promise<Json>;
    vbcEnrollments(id: string): Promise<Json>;
  } & Resource;

  visits: {
    list(query?: Json): Promise<Page>;
    stats(): Promise<Json>;
    create(body: Json, idempotencyKey?: string | { idempotencyKey?: string }): Promise<Json>;
    update(id: string, body: Json): Promise<Json>;
    correctDiagnosis(id: string, body: Json): Promise<Json>;
  } & Resource;

  ingest: {
    patients(body: Json, idempotencyKey?: string): Promise<Json>;
    schema(): Promise<Json>;
  };

  analytics: {
    overview(query?: AnalyticsFilters): Promise<Json>;
    clinical(query?: AnalyticsFilters): Promise<Json>;
    demographics(query?: AnalyticsFilters & { diseaseName?: string }): Promise<Json>;
    /** Requires an analyst+ role. */
    financial(query?: AnalyticsFilters): Promise<Json>;
    /** Requires an analyst+ role. */
    operational(query?: AnalyticsFilters): Promise<Json>;
    /** Requires an analyst+ role. */
    dataRange(query?: { branchId?: number }): Promise<Json>;
    /** Requires an analyst+ role. */
    filterOptions(dimension: AnalyticsDimension, query?: { search?: string; limit?: number }): Promise<{ data: { value: string | number; label: string; count: number }[] }>;
    patients(query?: {
      startDate?: string; endDate?: string; branchId?: number; segmentId?: number; mdcCode?: number;
      diseaseName?: string; search?: string; riskLevel?: 'Severe' | 'Moderate' | 'Low';
      page?: number; limit?: number;
    }): Promise<Json>;
    /** Run any Analysis Hub report — returns { items, stats }. Reports marked analyst+ need that role. */
    analysis(report: AnalysisReport, query?: AnalyticsFilters & {
      diseaseName?: string; breakdown?: 'gender' | 'visit_type' | 'appointment_mode' | 'department';
      granularity?: 'month' | 'day'; ageBands?: string[] | string; bmiBands?: string[] | string;
      insurancePolicies?: string[] | string; losBands?: string[] | string; icdCodes?: string[] | string;
      icdCategories?: string[] | string; isChronic?: 'true' | 'false'; riskTiers?: string[] | string;
    }): Promise<Json>;
    /** Disease prevalence vs city/national estimates. diseaseName required. */
    diseasePrevalence(query: { diseaseName: string; startDate?: string; endDate?: string; branchId?: number; segmentId?: number }): Promise<Json>;
  };
}

export type AnalysisReport =
  | 'payer' | 'payment_type' | 'revenue_trends' | 'gender' | 'age_group'
  | 'nationality' | 'bmi' | 'visit_mode' | 'visit_type' | 'patient_type'
  | 'appointment_mode' | 'registered_at_hospital' | 'departments' | 'physicians'
  | 'physicians_per_department' | 'physician_visit_time' | 'average_los'
  | 'average_lov' | 'waiting_time';

export type AnalyticsDimension =
  | 'facility_ids' | 'department_ids' | 'doctor_ids' | 'payers'
  | 'visit_modes' | 'visit_types' | 'payment_types' | 'nationalities'
  | 'genders' | 'icd_codes' | 'icd_categories' | 'disease_names' | 'phm_segments';

/**
 * Shared Analysis Hub filters. Arrays serialize to comma-separated values;
 * id filters take the numeric ids returned by analytics.filterOptions().
 */
export interface AnalyticsFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  branchId?: number;
  departmentIds?: number[] | string;
  doctorIds?: number[] | string;
  genders?: string[] | string;
  ageMin?: number;
  ageMax?: number;
  visitTypes?: string[] | string;
  visitModes?: string[] | string;
  payers?: string[] | string;
  paymentTypes?: string[] | string;
  maritalStatuses?: string[] | string;
  nationalities?: string[] | string;
  smoker?: 'true' | 'false';
  segmentId?: number;
  mdcCode?: number;
}

export default MedIntell;
