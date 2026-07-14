# Kaeve Coffee Management System - Presentation Q&A

## Project Overview & Ownership

**What problem does the app solve, and who is it for?**  
Kaeve is for coffee cooperative staff and member farmers. It solves the problem of scattered cooperative records: member profiles, cherry deliveries, milling, loans, fertilizer requests, payouts, and member communication are normally handled across paper, spreadsheets, and M-Pesa records. The system gives admins, managers, secretaries, field officers, and members one place to manage the coffee season workflow.

**What is the MVP?**  
The MVP is role-based cooperative management: authentication, member registration, delivery logging, season management, loan application/review, milling records, inventory totals, payout calculation, announcements, fertilizer requests, and a member portal. I deliberately left out full production M-Pesa C2B reconciliation and real-time notifications because STK Push repayment and in-app announcements were enough for the first working version.

**What is genuinely yours versus boilerplate/library code?**  
React, Django REST Framework, Django auth, and PostgreSQL are standard technologies. The project-specific parts are the cooperative domain rules: loan eligibility, future harvest/guarantor collateral, role permissions, payout deductions, delivery-to-inventory updates, milling inventory movement, fertilizer caps, and member-specific portal views.

**Why this folder structure?**  
The backend keeps the domain in `backend/kaeve/core`: models, serializers, services, views, permissions, and migrations. The frontend separates `api/` for backend calls, `components/` for reusable UI, `context/` for auth state, `pages/` for route-level screens, `routes/` for role-aware routing, and `utils/` for shared formatting/helpers. This keeps reusable code away from page-specific logic.

**If adding a new feature, which files would you touch?**  
For example, adding “coffee quality inspection” would start with a Django model, then a migration, serializer, viewset/permission, URL/router entry, frontend API file, page/component state, JSX display, and finally a route/sidebar link if needed.

**Most complex logic? Could it be simpler?**  
The loan and payout flow is the most complex. It combines eligibility, collateral type, guarantors, approved loan recovery, M-Pesa repayments, and payout deductions. With more time, I would split the financial logic into more focused services and add more automated tests around edge cases.

**Button click to updated screen example: loan repayment.**  
The member clicks “Send M-Pesa prompt.” React calls `loansAPI.repayMpesa`, which posts to `/api/loans/<id>/repay-mpesa/`. Django authenticates the user, checks that the loan belongs to that member and is approved, calls the M-Pesa STK helper, stores a pending `MpesaTransaction`, and returns JSON. The frontend shows the prompt message. When Safaricom calls the callback, the backend marks the transaction successful and creates a `LoanRepayment`.

## Frontend

**React structure and state.**  
Local form state lives in page components with `useState`, like the payout and milling forms. App-wide authenticated user state lives in `AuthContext`, because the navbar, protected routes, and portal need the same user/role information. Reusable UI lives in `components/ui`.

**Data fetching and errors.**  
Most pages fetch through `apiClient` and the `useApiResource` hook. The hook stores `data`, `isLoading`, `error`, and exposes `reload()`. Errors are shown in visible form or page error boxes instead of failing silently.

**Forms and validation.**  
The frontend uses controlled inputs. It enforces basic required fields, password confirmation, max fertilizer caps, and visible calculated values like loan deductions. Server-side validation still decides the truth; backend validation errors are surfaced through the API client error parser.

**Frontend auth.**  
Login posts credentials to `/api/auth/login/`. The frontend stores access and refresh tokens in `localStorage`, stores user data, and attaches the access token to future requests. On 401, it tries `/api/auth/refresh/`; if refresh fails, it clears tokens and redirects to login.

**Example useEffect.**  
In the member portal, effects reload portal records when `member` or `reloadKey` changes. If `reloadKey` were removed, submitting a loan or fertilizer request would not refresh the visible tables. If dependencies were too broad, it could refetch unnecessarily.

**Routing and protection.**  
`AppRoutes.jsx` maps paths to pages and allowed roles. If the user is not authenticated or does not have the required role, the route renders an access/redirect state rather than the protected page.

**Tailwind/CSS approach.**  
The UI uses reusable classes and components instead of repeating long class strings everywhere. Common elements like panels, tables, stat cards, buttons, tabs, and form fields have shared styling.

## Backend

**API design.**  
Core REST resources include `/api/members/`, `/api/seasons/`, `/api/deliveries/`, `/api/loans/`, `/api/payouts/`, `/api/milling-batches/`, `/api/inventory-stocks/`, `/api/announcements/`, and `/api/fertilizer-requests/`. Custom actions include `/api/loans/apply/`, `/api/loans/<id>/approve/`, `/api/seasons/<id>/generate-payouts/`, and `/api/loans/<id>/repay-mpesa/`.

**Models, serializers, views.**  
Models define database shape and core constraints. Serializers convert models to JSON and validate incoming data. Views/viewsets handle request flow, permissions, filtering, and special actions. Business rules that are reused live in `services.py`.

**Backend auth and authorization.**  
The app uses token/JWT-style auth. Login returns access and refresh tokens. The frontend sends `Authorization: Bearer <token>`. Authorization is role-based through `RoleBasedApiPermission` and role checks in views. Members are also scoped to their own records in querysets.

**Server-side validation.**  
Validation lives in serializers, model `clean()` methods, and database constraints. Examples: loan amount must be positive, season dates must make sense, milling output cannot exceed cherry input, fertilizer requests cannot exceed member caps, and payout rate cannot be negative.

**Business logic placement.**  
Reusable domain rules live in `services.py`: delivery inventory sync, milling inventory movement, loan eligibility, payout generation, and loan recovery totals. Views stay thinner and call those services.

**Errors.**  
DRF returns field-level 400 errors for validation, 401 for unauthenticated requests, 403 for forbidden roles, and 404 for missing resources. The frontend parses both JSON and HTML error responses into readable messages.

## Database

**Schema relationships.**  
`Member` can have many deliveries, loans, payouts, fertilizer requests, and ledger entries. `Season` groups deliveries, loans, milling batches, inventory, and payouts. `Loan` can have many repayments and M-Pesa transactions. Announcements can target many selected members through a many-to-many relationship.

**Constraints and indexes.**  
Primary keys and foreign keys are indexed by Django/PostgreSQL. Custom constraints protect important rules, such as positive loan amounts, non-negative payouts, non-negative inventory, positive M-Pesa transaction amounts, and valid season dates.

**Migrations.**  
Migrations are version-controlled schema history. When I change a model, I run `makemigrations` and `migrate`. Deleting migrations would desync the database from Django’s migration history, especially on Render/PostgreSQL.

**on_delete choices.**  
Important financial and operational records use `PROTECT` so a member, season, or loan cannot be accidentally deleted while dependent records exist. Some user references use `SET_NULL` where historical records should remain even if a user account is removed.

## Full-Stack Auth & Security

**Full auth flow.**  
User submits username/password. Django authenticates against hashed passwords. On success, the backend returns tokens and user role/member data. The frontend stores tokens, attaches the access token to requests, and route guards decide what the user can see. Logout clears stored tokens.

**Token storage trade-off.**  
Tokens are stored in `localStorage`, which is simple and works well for this capstone. The trade-off is XSS risk: malicious JS could read tokens. A stronger production approach would use httpOnly cookies with CSRF protection.

**CORS.**  
The frontend and backend are separate origins on Render, so Django must explicitly allow the frontend URL through `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS`.

**Environment variables.**  
Secrets like Django secret key, database URL, OAuth secrets, and M-Pesa credentials live in environment variables, not git. If leaked, attackers could access the database, forge auth-related behavior, or abuse payment integrations.

**Unauthenticated access.**  
Without login, users should only access public auth endpoints and health checks. Protected data endpoints require authentication and role permission.

## API Contracts

**Sample loan application request.**

```http
POST /api/loans/apply/
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "loan_type": "cherry_advance",
  "collateral_type": "future_harvest",
  "amount": "1000.00",
  "term_months": 6,
  "reason": "Farm inputs"
}
```

**Sample response.**

```json
{
  "id": 12,
  "member_name": "Jane Wanjiku",
  "amount": "1000.00",
  "status": "pending",
  "eligible_amount": "1500.00",
  "recovery_amount": "1025.00"
}
```

**API documentation gap.**  
The project has endpoint testing notes, but a stronger next step would be Swagger/OpenAPI or a polished README endpoint table.

## Performance & Scaling

**Likely bottlenecks.**  
Heavy pages could be payouts, reports, and member portal summaries because they aggregate deliveries, loans, and payouts. The backend already uses `select_related` in several viewsets, but more indexing, aggregation endpoints, caching, and query profiling would help as records grow.

**Scaling.**  
The app can scale vertically by increasing server/database resources. It can scale horizontally by running multiple stateless Django instances behind a load balancer, since auth is token-based and shared data is in PostgreSQL.

## Process, AI & Ownership

**Onboarding another developer.**  
Clone repo, create backend env vars, install Python dependencies, run migrations, install frontend packages, start Django and Vite, and create/seed users. The roughest part is environment setup, especially Render database and M-Pesa/OAuth credentials.

**AI usage.**  
AI helped with scaffolding, debugging, and feature implementation. I verified output by reading code, running Django checks, running migration dry-runs, building the frontend, testing flows in the browser, and adjusting logic when real errors appeared.

**Proving ownership.**  
I can trace features across model, serializer, view, API client, React state, and JSX. I can explain trade-offs like localStorage tokens, service-layer business logic, protected financial records, and why M-Pesa callbacks only create repayments after confirmed success.

## Trade-Offs & Improvements

**What I would rebuild differently.**  
I would split the large `core` Django app into smaller domain apps like `members`, `loans`, `payments`, and `operations`. I would also add automated tests earlier for loan/payout/M-Pesa edge cases.

**What I deliberately skipped.**  
I skipped full C2B PayBill reconciliation, SMS delivery notifications, real-time WebSockets, and advanced accounting exports because the MVP needed reliable cooperative workflows first.

**End-to-end feature example: M-Pesa loan repayment.**  
UI collects amount and phone number, frontend posts to the loan repayment action, backend validates ownership and outstanding amount, sends STK Push, stores a pending transaction, receives Safaricom callback, records repayment, updates outstanding loan balance, and payout generation deducts only the remaining amount.

