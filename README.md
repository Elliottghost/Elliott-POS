# Vista Kigali — Management Platform

Phases 1–2 for **Vista Kigali Bar - Resto & Accommodation**: authentication,
role-based access control, branch management, staff administration, audit trail,
business settings, an operations dashboard, a full restaurant module (menu,
branch pricing, floor plan, reservations, guest QR menus), a working till with
order capture, split payments and printable receipts, and a live kitchen display
that moves paid orders from queued to preparing, ready and served.

Branches: **Kimironko — Ku Isangano** (`KIM`) and **Rond-Point — Kuri Azam** (`RDP`).

---

## 1. Architecture

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, Server Components + Server Actions) |
| Language | TypeScript (strict), path alias `@/*` |
| Database | SQLite via `better-sqlite3` — a real file-backed relational database in WAL mode |
| ORM / migrations | Drizzle ORM + `drizzle-kit` (versioned SQL migrations in `drizzle/`) |
| Auth | Server-side sessions: random 256-bit token, stored SHA-256 hashed, `HttpOnly` cookie |
| Passwords | `scrypt` (N=16384, r=8, p=1) with per-password 16-byte salt, constant-time comparison |
| Validation | Zod schemas shared by server actions and services |
| Styling | Tailwind CSS v4 with design tokens, mobile-first, no UI framework dependency |

Why SQLite: the platform is deployed per-venue with a small number of concurrent
staff, and a single-node relational database keeps the whole stack verifiable and
backup-able (copy `data/vista-kigali.db`). The data layer is isolated in
`src/db` + `src/services`, so a move to PostgreSQL means changing the Drizzle
dialect and connection, not the application logic.

### Project layout

```
src/
  app/
    (auth)/login, forgot-password, reset-password   public auth screens
    (app)/dashboard, restaurant, pos, orders,
          menu, tables, reservations, kitchen, branches,
          staff, roles, audit-logs, settings,
          account                                 protected application
    orders/[id]/receipt                             printable receipt
    m/[slug]                                        public guest menu (table QR)
    api/menu-images/[file]                          uploaded dish photographs
    api/tables/[id]/qr                              printable table QR (SVG)
    api/kitchen/stream                              server-sent events for the kitchen board
    actions/auth.ts                                login/logout/reset/password-change
    forbidden/, not-found.tsx                      access-denied and 404 screens
  components/     reusable shell, layout, form and table primitives
  db/             schema.ts, client.ts, seed.ts
  lib/
    auth/         password.ts, session.ts, access.ts, reset.ts, staff-rules.ts
    permissions.ts  role matrix + permission catalogue
    audit.ts, validation.ts, format.ts, navigation.ts, uploads.ts, qr.ts
    kitchen-time.ts, kitchen-stations.ts  prep targets, station routing, status roll-up
    realtime/kitchen-events.ts  in-process push bus for kitchen screens
  services/       branches.ts, staff.ts, menu.ts, orders.ts, tables.ts,
                  reservations.ts, restaurant.ts, kitchen.ts, dashboard.ts,
                  audit.ts, settings.ts
scripts/migrate.ts
tests/            integration tests (isolated test database)
drizzle/          generated SQL migrations
```

**Separation of concerns:** pages render, server actions validate input and check
permissions, services enforce business rules and write to the database, and the
audit helper records every sensitive mutation. UI components never talk to the
database directly.

---

## 2. Database schema (18 tables)

| Table | Purpose |
| --- | --- |
| `users` | Staff accounts: email, scrypt hash, full name, role, branch, active flag, must-change-password, last login |
| `roles` | The seven operating roles with rank (used for delegation rules) |
| `permissions` | Permission catalogue keyed by stable ids (`staff.manage`, `reports.view_all`, …) |
| `role_permissions` | Many-to-many grants, editable by super administrators |
| `branches` | Trading locations: name, unique code, slug, address, contact, opening hours, active flag |
| `staff_profiles` | Employment record 1:1 with a user: employee code, job title, national ID, emergency contact, hire date, type, notes |
| `sessions` | Hashed session tokens, expiry, IP and user agent; deleted on logout/reset/deactivation |
| `password_reset_tokens` | Hashed single-use reset tokens with expiry, used-at and request IP |
| `audit_logs` | Append-only trail: actor snapshot, action, entity, branch, description, JSON metadata, IP, user agent |
| `business_settings` | Key/value business configuration (identity, currency, VAT, service charge, session hours) |
| `menu_categories` | Menu groupings with sort order and visibility |
| `menu_items` | Dishes and drinks: category, description, price in cents, station, photograph path, preparation time, featured flag, active flag |
| `branch_menu_items` | Per-branch override: sold-out flag and optional price override; absence means on sale at the brand price |
| `restaurant_tables` | Floor plan: branch, unique table code, seats, section, live status, stable QR token, in-service flag |
| `reservations` | Reservation book: branch, optional table, guest name/phone, business date, start time, duration, party size, status, special requests, audit actors |
| `orders` | Till orders: branch, sequential order number, payment status, kitchen fulfillment status (`queued`/`preparing`/`ready`/`served`) with its timestamp, channel, subtotal, service charge, VAT, total, guest/table details, paid-at |
| `order_items` | Order lines with price and name snapshots so receipts never change after repricing, plus each line's own kitchen progress for station routing |
| `payments` | Cash / mobile money / card payments per order, with reference and receiving staff member |

Foreign keys are enforced (`PRAGMA foreign_keys = ON`), with cascade rules for
sessions/profiles and restrictive rules for branch-bound records. Indexes cover
branch scoping, sessions, audit queries and order reporting.

---

## 3. Roles and permissions

| Role | Key permissions |
| --- | --- |
| Super Administrator | All permissions; bypasses branch scoping; consolidated reports; roles & settings management |
| Branch Manager | Dashboard, view branches, view/manage staff **inside own branch**, POS orders, payments, order cancellation, branch price overrides and sold-out flags, tables and reservations for the branch, **run the kitchen board**, branch reports, audit trail, view settings |
| Cashier | Dashboard, POS orders and payments for the branch, view menu, view tables and reservations, **view the kitchen board**, branch reports |
| Waiter / Waitress | Dashboard, open orders, view menus, view tables and reservations, **view the kitchen board** |
| Kitchen Staff | Dashboard, view orders and menu, **run the kitchen board** (start preparing, mark ready, mark served) |
| Accommodation Receptionist | Dashboard, room-service orders and payments, view menu, **manage tables and the reservation book**, branch reports |
| Inventory Manager | Dashboard, manage the brand-wide menu and prices, mark dishes sold out, view orders, branch reports |

Menu editing (`menu.manage`) is deliberately brand-wide and limited to the super
administrator and inventory manager. Branch managers hold `menu.pricing` and
`menu.availability`, so they can change what their house charges and whether a dish
is on sale — without touching the other branch or the brand price list.

Enforcement is always server-side:

* `hasPermission()` / `requirePermissionPage()` guard every page.
* Every server action re-checks the permission **and** the target record's branch.
* `branchScope()` returns `null` for super administrators and `[branchId]` for
  everyone else; every list/aggregate query is filtered by it.
* Rank-based delegation: a manager cannot assign or manage a role at or above
  their own rank, cannot touch another branch, and cannot manage their own account.
* The last active super administrator cannot be deactivated or demoted.

---

## 4. Running the app

Requirements: Node.js 22+ (tested on 26), npm.

```bash
npm install
cp .env.example .env          # then edit values
npm run db:setup              # apply migrations + seed foundation data
npm run dev                   # http://localhost:3000
```

Environment variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | `./data/vista-kigali.db` | SQLite file path |
| `APP_URL` | `http://localhost:3000` | Public origin used in password-reset links |
| `AUTH_EXPOSE_RESET_LINKS` | `false` | When `true` (and not production) the reset link is shown in the UI instead of only being sent/logged |
| `AUTH_RESET_TOKEN_TTL_MINUTES` | `30` | Reset link lifetime |
| `SEED_DEMO_DATA` | unset | `true` seeds 7 days of demo order history and a few reservations for dashboard figures |

Useful scripts: `npm run db:migrate`, `npm run db:seed`, `npm run db:generate`,
`npm run typecheck`, `npm run test`, `npm run build`.

> `data/` is git-ignored. Back it up; it contains the whole database.
> Change every seeded password before any real deployment.

### Seeded accounts

| Account | Password | Role |
| --- | --- | --- |
| `admin@vistakigali.rw` | `VistaAdmin#2026` | Super Administrator |
| `manager.kimironko@vistakigali.rw` | `Kimironko#2026` | Branch Manager — Kimironko |
| `manager.rondpoint@vistakigali.rw` | `RondPoint#2026` | Branch Manager — Rond-Point |
| `cashier.kimironko@vistakigali.rw` | `Cashier#2026` | Cashier (must change password) |
| `waiter.kimironko@vistakigali.rw` | `Waiter#2026` | Waiter (must change password) |
| `kitchen.kimironko@vistakigali.rw` | `Kitchen#2026` | Kitchen (must change password) |
| `reception.rondpoint@vistakigali.rw` | `Reception#2026` | Accommodation Receptionist |
| `inventory.rondpoint@vistakigali.rw` | `Inventory#2026` | Inventory Manager |

Seeding always creates the frozen 9-category menu, 19 dishes/drinks and 8 tables
per branch (`T-01`…`T-08`). Demo order history and reservations are seeded **only**
when `SEED_DEMO_DATA=true`; every dashboard aggregates real rows and shows an
honest empty state otherwise.

The table QR codes encode `/m/<branch-slug>?t=<token>`. Set **Business settings →
Public menu URL** to the live origin so printed codes keep working when the app
moves from localhost to the real domain.

---

## 5. Feature summary

* **Authentication** — email + password sign-in, generic failure messages and
  in-process attempt throttling; secure 12-hour sessions (hashed token, HttpOnly,
  SameSite=Lax, Secure in production); logout revokes the session server-side;
  forced password change for admin-issued/temporary passwords; self-service
  password reset with single-use, expiring hashed tokens and full session
  revocation on reset.
* **Authorization** — seven roles, a 24-permission catalogue, super-admin
  wildcard, permission matrix editor, rank-based staff delegation, branch scoping
  on every query, friendly `/forbidden` screen.
* **Branches** — list, create, edit, activate/deactivate, manager and staff counts,
  branch detail with assigned staff, strict isolation for non-super accounts.
* **Staff** — searchable/filterable directory, full account creation (user +
  profile in one transaction), role/branch changes, activation, temporary
  password issuance (shown once), profile and security panel, per-account audit
  history.
* **Dashboard** — sales today, orders today (open/cancelled), active staff,
  branch status, 7-day revenue trend, branch performance table (consolidated for
  super admins, scoped for managers), team composition, recent audited activity.
* **Audit trail** — filterable log (search, action, entity, branch, date range)
  with actor snapshots and IP addresses; writes never break the main action.
* **Business settings** — grouped settings editor with numeric validation and
  audit logging; read-only for branch managers.
* **Point of sale** — tap-to-add terminal scoped to one branch (super admins can
  switch branches), search and category filters, live cart with quantity steppers,
  service type, table, guest and notes, server-side price recalculation, and
  sequential per-branch order numbers (`KIM-20261110-0001`).
* **Menu management** — nine launch categories (Food, Starters, Main Courses,
  Desserts, Beverages, Cocktails, Wines, Spirits, Other) with ordering, visibility,
  safe deletion (empty categories only), a searchable/filterable item board,
  dish photographs stored with the database, preparation time, featured flag and
  brand-wide editing by the group.
* **Branch menus** — each house gets its own price for any item (blank = brand
  price), its own sold-out flags and its own guest menu. Branch managers reach a
  restricted item screen that exposes only their branch; the till and receipts
  always price at the branch price.
* **Tables** — a floor plan grouped by section, seats, live status
  (available/occupied/reserved/out of service), one-tap status changes, and a
  stable QR token per table with an inline SVG, SVG download and a printable guest
  menu. Tables with reservation history are deactivated rather than deleted.
* **Reservations** — a working book with pending/confirmed/seated/completed/
  cancelled/no-show states, table assignment filtered by branch, party-size
  validation against seats, branch scoping, status workflow (seating occupies the
  table, completing releases it), cancellation reasons and an overlap guard that
  refuses double-booking the same table for intersecting times.
* **Guest menu** — public, no sign-in, one branch per URL, table label from the QR
  token, effective branch prices, dish photographs, signature dishes, sold-out
  marks, opening hours and the service/VAT note.
* **Restaurant dashboard** — menu availability, table state, today's and pending
  reservations, seating and sales today, branch performance comparison, upcoming
  arrivals and house hours.
* **Kitchen display** — a three-column pass (queued / preparing / ready) fed only
  by paid orders, with item lines, table and guest, one-tap forward moves (plus a
  step back), and served orders leaving the board. Sections are routed by each
  dish's station: **Food** (kitchen), **Bar** and **Dessert** (pastry) each get a
  one-tap tab showing only their own lines, their own prep target and their own
  counts; a mixed order appears on every section it touches, and progress is kept
  per line, so the bar marking drinks ready never marks the food ready. The order
  status is the roll-up of its lines and only reads served when every section is
  done. Each ticket is timed against the
  slowest dish on it (15 minutes when no dish declares a prep time): a countdown
  turns amber near the target, then the card gets a red ring and a "min late" badge.
  Any late ticket raises a red alarm banner, and an optional alarm button (browser
  audio, armed with one tap) plays a chime as a ticket crosses its target. Late
  tickets jump to the top of their column. Ticket changes are pushed over a
  server-sent events stream, so a payment at the till or a move on one screen lands
  on every open board immediately; the stream reconnects by itself, catches up on
  wake or reconnect, and can be paused. It is branch-scoped for kitchen staff and
  managers; waiters and cashiers get a read-only board. Unpaid orders are counted in
  a discreet heads-up instead of reaching the line.
* **Payments** — cash, mobile money and card; part payments accumulate until the
  balance reaches zero, then the order is marked paid with a timestamp. Overpayment,
  payment on cancelled orders and cross-branch payments are rejected server-side.
* **Receipts** — printable receipt (A4/receipt roll via the browser dialog) with
  branch identity, itemised lines, service charge, VAT, payments and balance;
  cancelled orders are marked as not payable.
* **Orders** — scoped list with status tabs (open/paid/cancelled), search by order
  number, guest or table, branch filter for super admins, and a detail view with
  payment history and cancellation. Cancelling is blocked once money has been taken.
* **Design** — charcoal/cream/ember luxury palette, Fraunces + Inter typography,
  desktop sidebar and mobile drawer, 2-column stat grid on phones, responsive
  tables, accessible labels, visible focus states, reduced-motion support.

---

## 6. Verification

`npm run test` runs 82 integration tests against a separate SQLite database
(`data/test-foundation.db`, recreated per run) covering:

* password hashing (unique salts, verification, plaintext never stored, strength rules)
* authentication (case-insensitive email, wrong password, unknown user, deactivated account)
* permissions (super-admin wildcard, cashier limits, rank rules, self-management block)
* branch separation (scoped staff/branch lists, cross-branch access denied)
* staff lifecycle (real account + profile + audit row, duplicate email/code rejection,
  weak password rejection, cross-branch creation blocked, deactivation blocks sign-in)
* password reset (single-use token, expiry/consumption, weak password rejection,
  non-disclosure for unknown emails)
* business settings persistence and numeric validation
* audit trail contents
* POS money arithmetic (service charge then VAT, franc input parsing)
* order capture priced from the database, line snapshots, sold-out branch items,
  cross-branch order creation blocked, super-admin trading at both branches
* part payments, settlement threshold, overpayment rejection, cross-branch payment block
* cancellation rules (unpaid only, no payment afterwards, paid orders protected)
* POS permission matrix (cashier, waiter, manager, inventory, kitchen)
* menu category create/edit/delete, deletion refused while dishes remain
* dish creation with image path, preparation time and featured flag, search and
  featured filtering, edit and delete
* image uploads stored under `data/uploads/menu`, served path shape, non-image
  rejection and cleanup
* per-branch price overrides (POS price and order subtotal both use them) and
  independent sold-out flags
* table creation with a 32-character QR token, token lookup, edits, status changes,
  duplicate code rejection, cross-branch creation refusal and branch-scoped stats
* reservations: booking, confirmation, seating (table becomes occupied), completion
  (table released), overlap refusal, adjacent-time acceptance, cross-branch refusal,
  party larger than the table, and stats
* restaurant overview aggregation for consolidated and branch scopes
* restaurant permission matrix (waiters, cashiers, managers, receptionists)
* persistence of categories, tables and reservations across fresh reads
* kitchen board: paid orders only, item lines, branch scoping, queued → preparing →
  ready → served, served orders removed from the board, unpaid and skipped-step
  moves refused, cross-branch moves refused (super admin allowed), served-today
  count and audit entry
* kitchen permission matrix (kitchen staff and managers run the board; waiters,
  cashiers and receptionists see it read-only; inventory managers cannot)
* kitchen push events: branch-scoped fan-out to group and branch subscribers,
  unsubscribe and broken-stream cleanup, an event on every ticket move, and an
  `order.paid` event only when the balance settles (part payments stay silent)
* prep-time alarm maths: the slowest dish sets the target (default 15 minutes),
  the countdown rounds up, lateness starts at the due minute and the board orders
  expose their target to the UI
* station routing: roll-up from line progress, a mixed ticket shown with only one
  section's lines and target, a bar move leaving the food queued, a served section
  disappearing from its board while the others keep the ticket, the order turning
  served only after every section, a section with nothing on the ticket refused,
  and station summaries counting their own queue

Manual browser walkthrough performed on the running app:

1. Signed in as super administrator → dashboard renders live figures.
2. Created a staff account through the UI → redirected to the new profile with audit entry.
3. Signed out → session revoked, redirected to `/login`.
4. Signed in as cashier → opening `/staff` redirects to `/forbidden?permission=staff.view`.
5. Signed in as Rond-Point manager → branch list shows only Rond-Point; staff list
   shows only its 3 staff; opening the Kimironko branch URL redirects to `/forbidden`.
6. Ran the full reset flow for the new staff account (request → single-use link →
   new password → sign-in with the new password).
7. As super administrator, opened the POS, added two tilapia and one water →
   server-priced total RWF 48,675 → opened the order.
8. Recorded a cash payment for the balance → order flipped to Paid, receipt shows
   the lines, service charge, VAT, payment and a zero balance.
9. Marked a dish sold out at Kimironko → the Kimironko till shows “Sold out” while
   Rond-Point still sells it.
10. Signed in as the Rond-Point manager → opening the Kimironko order URL redirects
    to `/forbidden?permission=branch_scope`, and `/menu/new` redirects to
    `/forbidden?permission=menu.manage`.
11. Created the table `T-09` at Kimironko → QR code rendered with the public URL,
    SVG download returned `image/svg+xml`, and opening the encoded guest menu showed
    Kimironko prices with a “Table T-09 · Terrace” chip.
12. Uploaded a dish photograph for “Inyambo beef fillet” → saved under
    `/api/menu-images/…`, previewed in the editor, shown on the menu board and the
    guest menu.
13. Set the Kimironko branch price to RWF 26,000 → the KIM till and the menu board
    show 26,000 while Rond-Point keeps 24,000.
14. Booked Claudine Mutoni on T-03 at 19:00 and confirmed it → booking appears in the
    diary and the restaurant dashboard; a second booking at 19:30 on T-03 was refused
    with “Table T-03 is already booked 19:00–20:30…”.
15. Created and deleted a category through the UI; the deletion guard refused a
    category that still held dishes.
16. Signed in as the Kimironko manager → `/menu/new` is forbidden, the table list is
    scoped to Kimironko, and the item screen exposes only the Kimironko price panel.
17. Rang up a second order at Kimironko (half chicken + cocktail → RWF 32,450) and
    paid it at the till → both paid orders appeared on `/kitchen`, unpaid ones did not.
18. Moved order 0001 preparing → ready → served through the board and watched each
    step land in the next column; served orders left the board and raised the served
    count. Signed in as `kitchen.kimironko@…` → the board is Kimironko-only with full
    move buttons, and the sidebar lists Kitchen beside Restaurant/Menu.
19. Kept the board open in one tab and paid a new order at the till in another: the
    ticket appeared without a reload, and an instrumented EventSource recorded the
    push event 443 ms after the action. A second move, triggered on another screen,
    arrived as a `kitchen` event and updated the open board the same way. Pause closed
    the stream ("Updates paused"), Resume reconnected ("Live · push updates"). An
    unauthenticated request to `/api/kitchen/stream` returns 401.

Static checks: `npx tsc --noEmit` passes and `npm run build` completes with all
32 routes compiled (Node runtime, `better-sqlite3` externalized).

---

## 7. Known gaps / before production

* **Email delivery** — `src/lib/mail.ts` uses a console transport (the reset link is
  printed server-side and, in development only, surfaced in the UI). Plug in an
  SMTP/API provider there; no caller changes needed. Set `AUTH_EXPOSE_RESET_LINKS=false`
  and `APP_URL` to the real origin.
* **Login throttling** is in-memory per process; move to a shared store when running
  multiple instances.
* **No MFA** yet; add TOTP for super administrators as the next hardening step.
* **SQLite** suits one node per venue. For multi-node or high write concurrency,
  migrate to PostgreSQL behind the same services.
* **POS limits** — no refunds/voids after payment, discounts, cash-drawer
  reconciliation or end-of-day till report yet; one cart per terminal (no held
  orders).
* **Kitchen limits** — push is server-sent events from the Node process, which suits
  the one-process-per-venue deployment this app documents. With more than one app
  instance, an event only reaches screens connected to the process that handled the
  write; use a shared broker (Redis pub/sub, Postgres LISTEN/NOTIFY) or the same
  single-writer deployment. A reverse proxy must not buffer the stream (`text/event-stream`
  is sent with `no-transform` and `X-Accel-Buffering: no`). Changes written straight
  into SQLite bypass the bus, so all edits must go through the app. There is no station
  printing or course firing, and sections are the three fixed stations rather than
  configurable screens. Anyone with `kitchen.view` can open any section, and a move
  applies to every line in that section at once rather than to individual dishes.
  The alarm is per-screen and per-ticket: sound needs one
  tap to unlock the browser audio context, fires once when a ticket crosses its
  target (not repeatedly, and never on page load), and stops if the screen is
  closed or the alarm is muted. There is no manager escalation, no kitchen printer
  buzzer and no server-side notification when nobody is looking at a board. The
  board is a workflow view only: served does not settle or close the order, and
  recall is one step back rather than a full undo.
* **Reservations limits** — no deposit/prepayment, waiting list, SMS/email
  confirmations or calendar sync. The overlap guard is table-based: unassigned
  bookings never block each other, and staff can deliberately double-book one
  table by re-assigning it. There is no automatic table suggestion by party size.
* **Dish photographs** live on disk under `data/uploads/menu` (alongside the
  database) rather than in object storage; back up the whole `data/` folder, and
  move to S3-compatible storage before running multiple app servers.
* **QR codes** encode the URL configured in business settings. On a new host or
  domain, update that setting and reprint table cards so old codes keep resolving.
* **Receipt printing** uses the browser print dialog; a thermal printer needs a
  receipt-format adapter (58/80 mm) rather than A4 margins.
* **Automated UI/E2E suite** — the flows above were verified manually; only service-level
  integration tests are automated today.
* No backup schedule or observability integration is configured.

---

## 8. Suggested next phase

1. Inventory and supplier movements with the Inventory Manager role, deducting
   recipe quantities when orders are paid.
2. Accommodation: rooms, reservations, check-in/out with the receptionist role.
3. Cash-drawer sessions, end-of-day Z report and refunds with manager approval.
4. Station printers and course firing for a dedicated kitchen screen.
5. Consolidated cross-branch reporting and exports for super administrators.
