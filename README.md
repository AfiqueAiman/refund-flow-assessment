# ZUS Back Office: Refund Flow

The order page and refund flow for the ZUS back office (Regional Senior Frontend Developer technical assessment).

**Live demo:** _link to be added after deployment_

Staff open an order, click **Refund**, and go through two steps in one modal:

1. **Select items.** Pick individual units and their add-ons, and optionally the delivery fee. The total updates as they select.
2. **Review & details.** Check what will be refunded and the final amount confirmed by the server, then choose a reason and where the refund goes.

**Confirm** opens a confirmation dialog on top of the modal. Cancelling it keeps the modal and everything entered. Confirming submits the refund, closes both dialogs and updates the order page.

## Running it

Requires Node 22.12 or newer (Vitest and MSW need it).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript project build check |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build locally |

### Mock API and demo controls

There is no backend. The app calls `/api/...` through a normal `fetch` client, and [MSW](https://mswjs.io) answers those requests in the browser. The mock behaves like a real service:

- Responses take 400 to 1200 ms.
- Refund quote and submit calls fail about 10% of the time, either as a 500 or a network error.
- The server validates requests itself and recalculates amounts on its side.
- It stores state, so refunded items stay refunded after a reload. Data is kept in `sessionStorage`.

Use **Reset demo data** in the header to start over.

How requests reach the mock depends on the build:

- **`npm run dev`:** MSW's service worker intercepts real network requests, so calls show in DevTools' **Network** tab. If a call returns an empty 404 from `localhost:5173`, the browser has stopped the idle worker. Do a normal refresh (not a hard refresh) to bring it back.
- **Deployed demo / `npm run preview`:** the same handlers answer inside the page, with no service worker, so the demo keeps working after the tab sits idle. These calls don't appear in the Network tab.

In both cases every call is logged to the **Console**, for example `[api] POST /api/orders/ORD-10482/refunds/quote → 200 (812 ms)`. Expand an entry to see the request and response bodies.

Query parameters make specific behaviour easy to try:

| URL | Effect |
| --- | --- |
| `?latency=3000` | Every response takes 3 seconds |
| `?latency=0&failureRate=0` | Fast and reliable |
| `?failureRate=1` | Every request fails, including loading the order |
| `?scenario=conflict` | On the first submit, another staff member has "just refunded" one of the selected items |

The order data in `src/mocks/data/order.json` is copied unchanged from the [provided sample](https://raw.githubusercontent.com/zhuhang-jasper/refund-flow-assessment-data/master/order.json). The mock is switched on with `VITE_ENABLE_MOCKS=true` in `.env`. To use a real backend, set `VITE_ENABLE_MOCKS=false` and `VITE_API_BASE_URL`. No UI code changes are needed.

### Tests

- `src/domain/refundCalculation.test.ts`: unit tests for the refund calculation and selection rules. They cover:
  - add-ons and their drink
  - multi-unit items
  - already refunded items, including L2-2
  - add-ons left out of a drink refund
  - the delivery fee: optional, on its own, already refunded, or absent
  - full refunds on a partially refunded order
  - floating-point safety
  - currency formatting
- `src/features/refund/RefundFlow.test.tsx`: tests that go through the flow on screen against the same MSW handlers. They cover:
  - the happy path
  - cancelling the confirmation
  - a failed submit followed by a retry
  - the "refunded by someone else" conflict
  - the selection rules
  - the warning for a left-out add-on
- `src/mocks/inPageTransport.test.ts`: the deployed demo's in-page mock transport returns orders, API errors, and simulated network and server failures correctly.

## Tech stack

React 19, TypeScript (strict), Vite, MUI, Vitest + React Testing Library, MSW, oxlint and Prettier.

```
src/
  domain/          Pure TypeScript: types, money helpers, refund rules (no React)
  api/             Wire contracts, typed fetch client, mappers between the API and the app
  mocks/           MSW handlers (the stand-in backend), seed data, demo config
  features/order/  Order loading hook and item list
  features/refund/ Refund flow state (useReducer), modal, steps, confirmation dialog
  pages/           Order page
  theme.ts         ZUS-inspired MUI theme (all colours in one place)
```

---

## Written section

### a) API endpoints

All amounts on the wire are decimals in the order currency, matching the sample data. Errors always have the shape `{ "error": { "code": string, "message": string, "amount"?: number } }`.

**`GET /api/orders/:orderId`** returns the order.

```jsonc
// 200
{
  "order_id": "ORD-10482", "status": "completed", "currency": "MYR",
  "delivery_fee": 5.00, "delivery_fee_status": "paid",          // "paid" | "refunded"
  "items": [{
    "line_id": "L1", "name": "Iced Spanish Latte", "unit_price": 13.90,
    "units": [{ "unit_id": "L1-2", "status": "paid",
                "addons": [{ "addon_id": "A1", "name": "Extra Shot", "unit_price": 2.00, "status": "paid" }] }]
  }]
}
// 404 ORDER_NOT_FOUND
```

**`POST /api/orders/:orderId/refunds/quote`** asks the server to price a selection. Step 2 shows this amount. The request sends IDs only, never prices.

```jsonc
// Request
{ "items": [{ "unit_id": "L1-2", "addon_ids": ["A1"] }], "include_delivery_fee": true }
// 200
{ "currency": "MYR", "items_amount": 15.90, "delivery_fee_amount": 5.00, "amount": 20.90 }
// 409 ITEM_NOT_REFUNDABLE (already refunded), 422 VALIDATION_ERROR (unknown/duplicate ids, empty refund)
```

**`POST /api/orders/:orderId/refunds`** creates the refund. It requires an `Idempotency-Key` header. If the same key is sent again, the server returns the original result and does not refund twice.

```jsonc
// Request (headers: Idempotency-Key: <uuid>)
{
  "items": [{ "unit_id": "L1-2", "addon_ids": ["A1"] }],
  "include_delivery_fee": true,
  "reason": "late_delivery",          // wrong_item | missing_item | quality_issue | late_delivery | other
  "note": "Rider arrived 40 min late", // required when reason is "other", max 500 chars
  "channel": "original_payment",      // original_payment | in_app_credit
  "expected_amount": 20.90             // what staff confirmed; a check only, never trusted as the amount
}
// 201
{
  "refund_id": "RF-…", "order_id": "ORD-10482", "status": "succeeded",
  "amount": 20.90, "currency": "MYR", "reason": "late_delivery", "channel": "original_payment",
  "created_at": "2026-11-02T08:00:00.000Z",
  "order": { /* updated order, same shape as GET */ }
}
// 400 IDEMPOTENCY_KEY_REQUIRED | 409 ITEM_NOT_REFUNDABLE | 409 AMOUNT_MISMATCH (+ "amount": server total)
// 422 VALIDATION_ERROR | 500 INTERNAL_ERROR
```

In production I'd also expect `GET /api/orders/:orderId/refunds` for refund history and audit. The refund flow doesn't need it, so I didn't build it.

### b) Refund calculation

Both sides calculate it, with different jobs:

- **Frontend: a preview.** Step 1 recalculates on every checkbox change, with no network call, so the total updates instantly and doesn't flicker on slow connections. The logic is a pure, unit-tested module (`src/domain/refundCalculation.ts`). It works in integer minor units (sen), so floating-point errors can't happen. For example, 7.90 × 3 is 23.700000000000003 in floating point.
- **Backend: the source of truth.** The client only sends what to refund, as unit and add-on IDs. The server prices them from its own data, re-applies every rule (already refunded, add-on belongs to that unit, fee still refundable), and refunds the amount it calculated itself.

How the amount staff see is kept equal to the amount refunded:

1. **Step 2 shows the server's quote,** not the local number. Confirm is disabled until the quote arrives. If the quote differs from the preview, the server amount is shown along with a warning.
2. **Submit includes `expected_amount`,** the amount on the confirmation dialog. If the server's total differs, it refunds nothing and returns `409 AMOUNT_MISMATCH` with the correct amount. The UI then reloads the order and asks staff to review again. The same happens if an item was refunded by someone else in the meantime (`409 ITEM_NOT_REFUNDABLE`). Items that are no longer refundable are removed from the selection, with a notice.
3. **An idempotency key** is reused on retries. A timeout followed by "Try again" can't refund twice.
4. **Shared, explicit rules with tests on both sides.** In this repo the mock server's pricing is written separately from the frontend's on purpose, as two real services would be. In a real codebase I'd share test cases (or a contract test) between the frontend and backend so the two can't drift apart.

### c) Assumptions, questions & comments for the PM / designer

**Assumptions I made**

- **Refunding a drink without its add-ons is allowed.** The requirements say staff choose items *and* add-ons, and only forbid an add-on without its drink. Ticking a drink also ticks its add-ons, because that's the common case, and staff can untick them. **There's a consequence:** an add-on left out can *never* be refunded later. It can't be refunded on its own, and its drink can't be refunded again. The UI warns about this in both steps. On later refunds those add-ons show as "Not refundable", and on the order page as "Not refunded".
- **L2-2 in the sample data** has a refunded drink and add-ons still marked `paid`. I read this as exactly that case: the drink was refunded without its add-ons. It's valid data, and those add-ons are shown as not refundable.
- **Full refund** means every *remaining* refundable unit and add-on is selected. Already refunded items are skipped. The delivery fee stays optional and doesn't affect whether it counts as a full refund.
- **A delivery-fee-only refund is allowed,** for example for a late delivery where the items were fine. If the reason is "Late delivery" and the fee isn't included, step 2 shows a hint with an **Include fee** button. It isn't added automatically, because the brief makes the fee the staff's choice.
- **The reason "Other" requires a short note.** For other reasons the note is optional. Without it, "Other" tells finance and operations nothing.
- **Channel descriptions** ("may take a few business days", "added immediately") are placeholder copy and need confirming.
- **Clicking outside the modal doesn't close it,** so a half-finished refund isn't lost by accident. Escape, Cancel and the close button still close it.

**Questions**

1. Should refunding a drink always refund its add-ons? Or should an add-on be refundable on its own once its drink has been refunded? Either would remove the "stuck add-on" situation above.
2. Are there limits per channel? For example, original-payment refunds only within N days of the order, or a maximum amount without manager approval.
3. Which roles can refund, and is approval needed above some amount? Should the order page show refund history (who, when, why, how much)?
4. Should refunds be partial *amounts* (e.g. 50% for a quality issue), or only whole items as specified?
5. How should the order status change after a full refund (`refunded` / `partially_refunded`)? Is the customer notified automatically?
6. Tax and rounding rules per country. Do refunds need to show tax separately in some markets?
7. Do we need to support several orders at once, or are bulk refunds out of scope?

**Design comments**

- The confirmation dialog repeats the amount and channel in plain language ("Refund RM 20.90 for 1 item and the delivery fee … to original payment method"). That's what staff actually need to check before confirming.
- On phones the modal goes full-screen. On tablets and desktops it's a centred dialog with a fixed footer showing the total.

### d) Key decisions & trade-offs

- **MUI rather than Tailwind + Radix.** MUI is what I use day to day. Its Dialog handles focus trapping, focus return, stacked dialogs (Escape only closes the top one) and ARIA out of the box. That let me spend the time on the refund logic. The trade-off is a bigger bundle and a different stack from yours. I'd move to Tailwind + Radix on the team.
- **The refund rules are a pure TypeScript module,** separate from React. It's easy to unit test, easy to reuse, and the components stay simple.
- **Money in integer minor units** everywhere inside the app, converted at the API boundary. Decimal places come from `Intl` (MYR 2, JPY 0), and formatting uses the order's currency, because the back office runs in several countries.
- **`useReducer` for the flow state** (step, selection, reason, note, channel, quote, submit, idempotency key). The reducer is pure and the transitions are explicit. A global store wasn't justified for a single modal.
- **MSW for the mock API.** The app makes real HTTP calls, the same handlers serve the browser and the tests, and changing to a real backend is a config change. In a normal project MSW would only run in development and tests. Here it also runs in the deployed demo because there's no backend.
- **No service worker in the deployed demo.** The worker keeps its list of mocked pages in memory. When the browser stops an idle worker, for example after the tab sits in the background, requests silently go to the network and fail with 404. So the production build sends requests to the same MSW handlers inside the page (`src/mocks/inPageTransport.ts`), through a swappable transport in the API client. Development keeps the service worker so calls stay visible in the Network tab. The trade-off is that demo calls only show in the console log, not the Network tab.
- **The server quote in step 2** costs one extra request, but the number staff confirm is the number the server will refund.
- **Seed data copied into the repo,** not fetched from the GitHub URL at runtime. The tests stay fast and predictable, the demo doesn't depend on a third-party file, and refunds can be saved.
- **Selection keyed by `unitId:addonId`.** Add-on IDs repeat across units (`A1` appears under both L1 units), so keying by add-on ID alone would be a bug.
- **No router.** The brief is one page plus a modal, and navigation is out of scope.
- **Theme.** The colours approximate ZUS's public branding (classic blue, ice white, coffee accent). No design tokens were provided, so they're all in `theme.ts` to make swapping them easy. The header uses a text wordmark, not the real logo.

### e) Known limitations & next steps

- **Single, hard-coded order** (`VITE_ORDER_ID`). There's no order search or routing. That's out of scope.
- **No authentication, roles or audit trail** in the UI. The API would need to record who issued each refund.
- **The mock's idempotency** doesn't check that a reused key comes with the same request body. A real service should reject that with a 422.
- **The API uses decimal amounts** to match the sample data. I'd move the contract to integer minor units with an explicit currency.
- **English only.** Currency and number formatting follow the locale, but the text isn't translated yet. Next step: an i18n library and translation files.
- **Bundle size** is about 570 kB minified (about 176 kB gzipped) for the app chunk, mostly React and MUI. The mock is lazy-loaded separately. With more time I'd look at code-splitting and the bundle.
- **Testing.** There are unit and component tests, but no end-to-end tests in a real browser yet. Next I'd add Playwright for the main flow at desktop and tablet sizes, plus an accessibility check (axe).
- **Escape with a selection in progress** closes the modal without asking. Depending on staff feedback, a "discard this refund?" prompt might be worth adding.

---

## How I used AI

As the brief allows, I used an AI coding agent (Devin) the way I would day to day: for scaffolding, first drafts of components and tests, and drafting this README. I made the product and technical decisions, and I reviewed and tested the result:

- **Stack choices:** MUI rather than Tailwind/Radix, no router, Vite + Vitest, and MSW for the mock API.
- **Product decisions:** delivery-fee-only refunds, the "full refund" definition, the late-delivery hint, and keeping seed data in the repo rather than fetching the GitHub URL at runtime.
- **Issues I found in manual testing and had fixed:**
  - Add-ons left out of a drink refund were wrongly labelled "Refunded with item". They now show as "Not refundable" / "Not refunded".
  - The mock API stopped responding after the tab sat idle, because of the service worker lifecycle. This led to the in-page transport for the deployed demo.
- **The "can't be refunded later" warning,** added after I questioned whether a drink can be refunded without its add-ons.
