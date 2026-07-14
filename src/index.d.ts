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
    create(body: { name: string }, idempotencyKey?: string): Promise<Json>;
    update(payerId: string, body: Json): Promise<Json>;
  } & Resource;

  patients: {
    list(query?: Json): Promise<Page>;
    retrieve(id: string): Promise<Json>;
    create(body: Json, idempotencyKey?: string): Promise<Json>;
    update(id: string, body: Json): Promise<Json>;
  } & Resource;

  visits: {
    list(query?: Json): Promise<Page>;
    stats(): Promise<Json>;
    create(body: Json, idempotencyKey?: string): Promise<Json>;
    update(id: string, body: Json): Promise<Json>;
    correctDiagnosis(id: string, body: Json): Promise<Json>;
  } & Resource;

  ingest: {
    patients(body: Json, idempotencyKey?: string): Promise<Json>;
    schema(): Promise<Json>;
  };
}

export default MedIntell;
