// @medintell/sdk — official JavaScript/TypeScript client for the MedIntell REST API.
// Zero dependencies (uses global fetch — Node 18+ or any modern runtime).

const DEFAULT_BASE_URL = 'https://api.medintell.co';

export class MedIntellError extends Error {
  constructor(message, { status, code, type, requestId } = {}) {
    super(message);
    this.name = 'MedIntellError';
    this.status = status;
    this.code = code;
    this.type = type;
    this.requestId = requestId;
  }
}

// --- case conversion (SDK uses camelCase; the API speaks snake_case) ---------
const toSnake = (s) => s.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function convertKeys(value, fn) {
  if (Array.isArray(value)) return value.map((v) => convertKeys(v, fn));
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [fn(k), convertKeys(v, fn)]));
  }
  return value;
}
const encodeBody = (o) => convertKeys(o, toSnake);
const decodeBody = (o) => convertKeys(o, toCamel);

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VERSION = '0.4.0';

class HttpClient {
  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, timeout = 30000, maxRetries = 2 }) {
    if (!apiKey) throw new MedIntellError('apiKey is required');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
    this.maxRetries = maxRetries;
  }

  async request(method, path, { query, body, idempotencyKey } = {}) {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) url.searchParams.set(toSnake(k), String(v));
      }
    }
    const headers = { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json', 'User-Agent': `medintell-node/${VERSION}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (method === 'POST') headers['Idempotency-Key'] = idempotencyKey || uuid();

    let attempt = 0;
    for (;;) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);
      let res;
      try {
        res = await fetch(url, {
          method,
          headers,
          body: body !== undefined ? JSON.stringify(encodeBody(body)) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < this.maxRetries) {
          await sleep(2 ** attempt * 200 + Math.random() * 100);
          attempt++;
          continue;
        }
        throw new MedIntellError(`network error: ${err.message}`);
      }
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < this.maxRetries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          await sleep(retryAfter ? retryAfter * 1000 : 2 ** attempt * 200 + Math.random() * 100);
          attempt++;
          continue;
        }
      }

      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const e = payload.error || {};
        throw new MedIntellError(e.message || `HTTP ${res.status}`, {
          status: res.status,
          code: e.code,
          type: e.type,
          requestId: e.request_id || res.headers.get('x-request-id'),
        });
      }
      return decodeBody(payload);
    }
  }

  get(path, query) {
    return this.request('GET', path, { query });
  }
  post(path, body, idempotencyKey) {
    // Docs show create(body, { idempotencyKey }) — accept the options object
    // form as well as a bare string.
    const key = idempotencyKey && typeof idempotencyKey === 'object'
      ? idempotencyKey.idempotencyKey
      : idempotencyKey;
    return this.request('POST', path, { body, idempotencyKey: key });
  }
  put(path, body) {
    return this.request('PUT', path, { body });
  }
}

// --- resources ---------------------------------------------------------------

class Resource {
  constructor(http, base) {
    this._http = http;
    this._base = base;
  }
  /** Async iterator that walks every page via the cursor. */
  async *iterate(query = {}) {
    let cursor = ''; // empty cursor = keyset mode from page one
    for (;;) {
      const page = await this._http.get(this._base, { limit: 200, ...query, cursor });
      for (const row of page.data || []) yield row;
      if (!page.hasMore || !page.nextCursor) return;
      cursor = page.nextCursor;
    }
  }
}

class Organizations extends Resource {
  constructor(http) { super(http, '/api/v1/organizations'); }
  list() { return this._http.get(this._base); }
  retrieve(orgId) { return this._http.get(`${this._base}/${orgId}`); }
}

class Facilities extends Resource {
  constructor(http) { super(http, '/api/v1/branches'); }
  list() { return this._http.get(this._base); }
  create({ orgId, ...body }) { return this._http.post(`/api/v1/organizations/${orgId}/branches`, body); }
}

class Departments extends Resource {
  constructor(http) { super(http, '/api/v1/departments'); }
  list(query) { return this._http.get(this._base, query); }
  retrieve(id) { return this._http.get(`${this._base}/${id}`); }
  create(body, idempotencyKey) { return this._http.post(this._base, body, idempotencyKey); }
  update(id, body) { return this._http.put(`${this._base}/${id}`, body); }
  kpis(query) { return this._http.get(`${this._base}/kpis`, query); }
}

class Doctors extends Resource {
  constructor(http) { super(http, '/api/v1/doctors'); }
  list(query) { return this._http.get(this._base, query); }
  retrieve(id) { return this._http.get(`${this._base}/${id}`); }
  create(body, idempotencyKey) { return this._http.post(this._base, body, idempotencyKey); }
  update(id, body) { return this._http.put(`${this._base}/${id}`, body); }
  kpis(query) { return this._http.get(`${this._base}/kpis`, query); }
}

class Payers extends Resource {
  constructor(http) { super(http, '/api/v1/payers'); }
  list(query) { return this._http.get(this._base, query); }
  retrieve(payerId) { return this._http.get(`${this._base}/${payerId}`); }
  create(body, idempotencyKey) { return this._http.post(this._base, body, idempotencyKey); }
  update(payerId, body) { return this._http.put(`${this._base}/${payerId}`, body); }
}

class Patients extends Resource {
  constructor(http) { super(http, '/api/v1/patients'); }
  list(query) { return this._http.get(this._base, query); }
  retrieve(id) { return this._http.get(`${this._base}/${id}`); }
  create(body, idempotencyKey) { return this._http.post(this._base, body, idempotencyKey); }
  update(id, body) { return this._http.put(`${this._base}/${id}`, body); }
  screeningEligibility(id) { return this._http.get(`${this._base}/${id}/screening-eligibility`); }
  screeningMatches(id) { return this._http.get(`${this._base}/${id}/screening-matches`); }
  vbcEligibility(id) { return this._http.get(`${this._base}/${id}/vbc-eligibility`); }
  vbcEnrollments(id) { return this._http.get(`${this._base}/${id}/vbc-enrollments`); }
}

class Visits extends Resource {
  constructor(http) { super(http, '/api/v1/visits'); }
  list(query) { return this._http.get(this._base, query); }
  stats() { return this._http.get(`${this._base}/stats`); }
  create(body, idempotencyKey) { return this._http.post(this._base, body, idempotencyKey); }
  update(id, body) { return this._http.put(`${this._base}/${id}`, body); }
  correctDiagnosis(id, body) { return this._http.put(`${this._base}/${id}/diagnoses`, body); }
}

class Ingest {
  constructor(http) { this._http = http; }
  patients(body, idempotencyKey) { return this._http.post('/api/v1/ingest/patients', body, idempotencyKey); }
  schema() { return this._http.get('/api/v1/ingest/schema'); }
}

/**
 * Analysis Hub — the same aggregates the MedIntell dashboard shows.
 * Every overview accepts the shared filter set (camelCase; arrays become
 * CSV): startDate, endDate, branchId, departmentIds, doctorIds, genders,
 * ageMin, ageMax, visitTypes, visitModes, payers, paymentTypes,
 * maritalStatuses, nationalities, smoker, segmentId, mdcCode.
 * Id filters take the numeric ids returned by filterOptions().
 */
class Analytics {
  constructor(http) { this._http = http; this._base = '/api/v1/analytics'; }
  /** Headline KPIs: patients, visits, growth, top departments/diagnoses, trend. */
  overview(query) { return this._http.get(`${this._base}/overview`, query); }
  /** Top ICD diagnoses, chronic disease burden, clinical mix. */
  clinical(query) { return this._http.get(`${this._base}/clinical/overview`, query); }
  /** Gender / nationality / visit-mode distributions (diseaseName profiles one condition). */
  demographics(query) { return this._http.get(`${this._base}/demographics/overview`, query); }
  /** Revenue totals, average cost, revenue per patient. Requires analyst+ role. */
  financial(query) { return this._http.get(`${this._base}/financial/overview`, query); }
  /** Throughput and utilisation metrics. Requires analyst+ role. */
  operational(query) { return this._http.get(`${this._base}/operational/overview`, query); }
  /** Years/months that actually have visit data — call before picking dates. */
  dataRange(query) { return this._http.get(`${this._base}/data-range`, query); }
  /** Valid values (with counts) for a filter dimension, e.g. 'department_ids', 'payers'. */
  filterOptions(dimension, query) { return this._http.get(`${this._base}/filter-options/${dimension}`, query); }
  /** Drill-down patient list for the filtered population. */
  patients(query) { return this._http.get(`${this._base}/patients`, query); }
  /**
   * Run any Analysis Hub report — returns { items, stats }.
   * Reports: payer, payment_type, revenue_trends, gender, age_group,
   * nationality, bmi*, visit_mode, visit_type, patient_type,
   * appointment_mode, registered_at_hospital, departments, physicians,
   * physicians_per_department*, physician_visit_time, average_los*,
   * average_lov*, waiting_time*  (* = analyst+ role).
   */
  analysis(report, query) {
    const path = ANALYSIS_REPORT_PATHS[report];
    if (!path) throw new MedIntellError(`unknown analysis report: ${report}`);
    return this._http.get(`${this._base}/${path}`, query);
  }
  /** Disease prevalence vs city/national estimates. diseaseName is required. */
  diseasePrevalence(query) { return this._http.get(`${this._base}/clinical/disease-prevalence-analysis`, query); }
}

const ANALYSIS_REPORT_PATHS = {
  payer: 'financial/payer',
  payment_type: 'financial/payment-type',
  revenue_trends: 'financial/revenue-trends',
  gender: 'demographics/gender',
  age_group: 'demographics/age-group',
  nationality: 'demographics/nationality',
  bmi: 'demographics/bmi',
  visit_mode: 'service/visit-mode',
  visit_type: 'service/visit-type',
  patient_type: 'service/patient-type',
  appointment_mode: 'service/appointment-mode',
  registered_at_hospital: 'service/registered-at-hospital',
  departments: 'performance/departments',
  physicians: 'performance/physicians',
  physicians_per_department: 'performance/physicians-per-department',
  physician_visit_time: 'performance/physician-visit-time',
  average_los: 'utilization/average-los',
  average_lov: 'utilization/average-lov',
  waiting_time: 'utilization/waiting-time',
};

class Vbc {
  constructor(http) { this._http = http; this._base = '/api/v1/vbc'; }
  /** All VBC program journeys for a patient. id = pat_… or "mrn:<MRN>". */
  patientJourneys(id) { return this._http.get(`${this._base}/patients/${encodeURIComponent(id)}/journeys`); }
  /** Point-of-care: what this patient owes now, with fill links. */
  patientDue(id) { return this._http.get(`${this._base}/patients/${encodeURIComponent(id)}/due`); }
  /** Qualified-but-not-enrolled programs. */
  patientEligibility(id) { return this._http.get(`${this._base}/patients/${encodeURIComponent(id)}/eligibility`); }
  /** Enroll a patient (idempotent). body: { programId, indexDate? }. */
  enroll(id, body) { return this._http.post(`${this._base}/patients/${encodeURIComponent(id)}/journeys`, body); }
  decline(journeyId, body) { return this._http.post(`${this._base}/journeys/${journeyId}/decline`, body); }
  deferItem(journeyId, taskId, body) { return this._http.post(`${this._base}/journeys/${journeyId}/items/${taskId}/defer`, body); }
  declineItem(journeyId, taskId, body) { return this._http.post(`${this._base}/journeys/${journeyId}/items/${taskId}/decline`, body); }
  /** Org worklist. query: { status, programId?, dueBefore?, limit? }. */
  worklist(query) { return this._http.get(`${this._base}/journeys/items`, query); }
  /** List the org's VBC programs (discover program ids to enroll into). */
  programs(query) { return this._http.get('/api/v1/vbc/programs', query); }
  /** Replay feed. query: { cursor?, types?, limit? }. */
  events(query) { return this._http.get(`${this._base}/events`, query); }
}

class Screening {
  constructor(http) { this._http = http; this._base = '/api/v1/screening'; }
  /** All screening statuses for a patient. id = pat_… or "mrn:<MRN>". */
  patientStatuses(id) { return this._http.get(`${this._base}/patients/${encodeURIComponent(id)}/statuses`); }
  /** Org action list. query: { status, criteriaId?, facilityId?, limit? }. */
  worklist(query) { return this._http.get(`${this._base}/worklist`, query); }
  notified(statusId) { return this._http.post(`${this._base}/statuses/${statusId}/notified`, {}); }
  /** Mark done with external evidence. body: { completedOn? }. */
  report(statusId, body) { return this._http.post(`${this._base}/statuses/${statusId}/report`, body); }
  /** Patient "later". body: { until }. */
  defer(statusId, body) { return this._http.post(`${this._base}/statuses/${statusId}/defer`, body); }
  /** Patient "no". body: { reason? }. */
  decline(statusId, body) { return this._http.post(`${this._base}/statuses/${statusId}/decline`, body); }
  /** Clinician exclusion. body: { reason?, until? }. */
  exclude(statusId, body) { return this._http.post(`${this._base}/statuses/${statusId}/exclude`, body); }
  /** List the org's screening criteria (discover criteria ids). */
  criteria(query) { return this._http.get('/api/v1/population-screening/criteria', query); }
  events(query) { return this._http.get(`${this._base}/events`, query); }
}

export class MedIntell {
  /**
   * @param {{ apiKey: string, baseUrl?: string, timeout?: number, maxRetries?: number }} opts
   */
  constructor(opts = {}) {
    const http = new HttpClient(opts);
    this._http = http;
    this.organizations = new Organizations(http);
    this.facilities = new Facilities(http);
    this.departments = new Departments(http);
    this.doctors = new Doctors(http);
    this.payers = new Payers(http);
    this.patients = new Patients(http);
    this.visits = new Visits(http);
    this.ingest = new Ingest(http);
    this.analytics = new Analytics(http);
    this.vbc = new Vbc(http);
    this.screening = new Screening(http);
  }

  /** Authenticated connectivity check. */
  health() {
    return this._http.get('/api/v1/health');
  }
}

export default MedIntell;
