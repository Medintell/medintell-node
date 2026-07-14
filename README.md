# @medintell/sdk

Official JavaScript / TypeScript SDK for the [MedIntell REST API](https://docs.medintell.co/api/overview).
Zero dependencies — uses the platform `fetch` (Node 18+, Deno, Bun, or the browser
via a server proxy; never ship your key to a browser).

## Install

```bash
npm install @medintell/sdk
```

## Quickstart

```js
import { MedIntell } from '@medintell/sdk';

const mi = new MedIntell({ apiKey: process.env.MI_KEY });

// Verify the connection
const health = await mi.health();
// { status: 'ok', orgId: 'org_3aK9Lm', role: 'manager', facilityId: 'fac_1B7dQ2' }

// Seed reference data in dependency order, reusing the returned ids
const dept  = await mi.departments.create({ name: 'Cardiology', facilityId: 'fac_1B7dQ2' });
const doc   = await mi.doctors.create({ name: 'Dr. Khalid Hassan', departmentId: dept.id, facilityId: 'fac_1B7dQ2' });
const payer = await mi.payers.create({ name: 'Northwind Insurance' });

const patient = await mi.patients.create({
  mrn: 'MRN-2026-00001',
  facilityId: 'fac_1B7dQ2',
  firstName: 'Ahmed',
  lastName: 'Al-Saud',
  dob: '1985-03-15',
  gender: 'M',
});

const visit = await mi.visits.create({
  facilityId: 'fac_1B7dQ2',
  patientMrn: 'MRN-2026-00001',
  sourceVisitId: 'V-2026-12345',
  visitDate: '2026-06-15T10:30:00',
  typeOfVisit: 'Consultation',
  departmentId: dept.id,
  doctorId: doc.id,
  payerId: payer.payerId,
  totalCost: 1500.0,
});
```

## Features

- **Resource model** — `mi.<resource>.<action>()` mirrors the REST API.
- **camelCase in, camelCase out** — the SDK converts to/from the API's snake_case.
- **Auth** — the API key is attached to every request.
- **Idempotency** — every create sends an `Idempotency-Key` automatically; pass your
  own as the last argument to make a specific retry idempotent.
- **Retries** — `429` / `5xx` / network errors retry with backoff (honours `Retry-After`).
- **Cursor pagination** — `for await (const row of mi.patients.iterate()) { … }`.
- **Typed errors** — failures throw `MedIntellError` with `.status`, `.code`, `.requestId`.

## Pagination

```js
for await (const patient of mi.patients.iterate({ search: 'MRN-2026' })) {
  console.log(patient.mrno);
}
```

## Errors

```js
import { MedIntell, MedIntellError } from '@medintell/sdk';
try {
  await mi.patients.retrieve('pat_does_not_exist');
} catch (err) {
  if (err instanceof MedIntellError) {
    console.error(err.status, err.code, err.requestId);
  }
}
```

## License

MIT
