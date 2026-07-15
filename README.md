# Kaeve Coffee Management System

Kaeve Coffee Management System is a full-stack web application for running coffee cooperative operations. It brings member records, coffee deliveries, milling, inventory, loans, fertilizer requests, announcements, M-Pesa loan repayments, and payouts into one role-based system.

The project is built with React, Django REST Framework, and PostgreSQL.

## Problem It Solves

Coffee cooperatives often manage important records across paper books, spreadsheets, phone calls, and M-Pesa messages. That makes it difficult to know:

- Which members are registered
- How much cherry coffee has been delivered
- What has been milled into parchment or green beans
- Which members have active loans
- How much should be deducted during payout
- Which fertilizer requests have been approved
- What announcements have reached members

Kaeve solves this by giving cooperative staff and members a shared digital workspace.

## Main Users

- **Admin**: Manages users, seasons, loans, payouts, reports, and system-wide records.
- **Manager**: Oversees operations and approves or rejects loans and requests.
- **Secretary**: Helps members with cooperative processes such as loan applications and delivery records.
- **Field Officer**: Records coffee deliveries.
- **Member/Farmer**: Views personal records, applies for loans, requests fertilizer, receives announcements, downloads statements, and repays loans through M-Pesa.

## Core Features

### Authentication and Roles

- Username/password login
- Google OAuth login
- Token-based API authentication
- Role-aware navigation and protected routes
- Members can complete their profile after signup or Google login
- Members can set/update username and password for future login

### Members

- Register members
- View member list and member detail pages
- Track membership number, phone, location, farm size, status, and linked user account

### Seasons

- Create and edit seasons
- Set payout rate per kilogram
- Mark active/closed seasons
- Delete seasons when no dependent records exist

### Deliveries

- Log cherry deliveries by member, season, collection point, grade, and weight
- Inventory updates automatically when deliveries are recorded
- Field officers and secretaries can record deliveries based on permissions

### Milling and Inventory

- Record milling batches
- Track cherry input, parchment output, green bean output, and outturn ratio
- Milling consumes cherry from total season inventory, including collection-point stock
- Inventory groups stock by cherry, parchment, and green beans
- Milling page has a season selector so available cherry and batch records match the selected season

### Loans

- Members can apply for loans from the portal
- Loan eligibility can use future harvest/crop lien or member guarantor
- Admin/manager approves or rejects loans
- Decisions can be corrected by reopening loans
- Loan details include guarantor, collateral type, interest, recovery amount, repayment total, and outstanding amount

### M-Pesa Loan Repayment

- Members can repay approved loans through M-Pesa STK Push
- Backend creates a pending M-Pesa transaction
- Safaricom callback confirms success or failure
- Successful payments create a loan repayment record
- Payout deductions use the remaining outstanding loan balance, not the original loan amount

### Payouts

- Admin/manager can generate payouts for a season
- Payouts use delivered kilograms and season payout rate
- Loan deductions and other deductions are applied
- Members can download payout statements
- Admins can export payout records for M-Pesa/bulk processing

### Fertilizer

- Admin/manager creates fertilizer inventory
- Member cap per fertilizer type can be set
- Members request available fertilizer
- Approved fertilizer requests reduce factory stock
- Members cannot exceed the configured cap

### Announcements

- Admin/manager can publish announcements
- Announcements can go to all members or selected members
- Member portal displays relevant announcements

### Reports

- Delivery reports
- Members report
- Loan deduction and payout reports
- Downloadable records for cooperative operations

## Technology Stack

### Frontend

- React
- Vite
- CSS/Tailwind-style utility classes
- Lucide React icons
- Custom reusable UI components

### Backend

- Django
- Django REST Framework
- Custom token authentication
- Django model validation and database constraints
- Service layer for business logic

### Database

- PostgreSQL

### Deployment

- Backend: Render Web Service
- Frontend: Render Static Site
- Database: Render PostgreSQL or configured PostgreSQL instance

### Third-Party Integrations

- Google OAuth
- Safaricom Daraja M-Pesa STK Push

## Project Structure

```txt
backend/
  kaeve/
    core/
      models.py          # Database models
      serializers.py     # API serializers and validation
      views.py           # API views, viewsets, and custom actions
      services.py        # Business logic
      permissions.py     # Role permissions and queryset scoping
      mpesa.py           # M-Pesa STK Push integration
      urls.py            # API routes
      migrations/        # Database migrations
    kaeve/
      settings.py        # Django settings
      urls.py            # Project URL config
    manage.py

frontend/
  src/
    api/                 # API request functions
    components/          # Reusable UI and layout components
    context/             # Auth context
    hooks/               # Shared hooks
    pages/               # Route-level pages
    routes/              # Role-aware app routes
    utils/               # Formatters and helpers
```

## Important Backend Endpoints

```txt
POST /api/auth/register/
POST /api/auth/login/
POST /api/auth/refresh/
POST /api/auth/logout/
GET  /api/auth/me/
POST /api/auth/complete-member-profile/
POST /api/auth/update-login-credentials/

GET/POST/PATCH/DELETE /api/members/
GET/POST/PATCH/DELETE /api/seasons/
GET/POST/PATCH/DELETE /api/deliveries/
GET/POST/PATCH/DELETE /api/milling-batches/
GET/POST/PATCH/DELETE /api/inventory-stocks/
GET/POST/PATCH/DELETE /api/loans/
POST /api/loans/apply/
POST /api/loans/<id>/approve/
POST /api/loans/<id>/reject/
POST /api/loans/<id>/reopen/
POST /api/loans/<id>/repay-mpesa/

GET/POST/PATCH/DELETE /api/payouts/
POST /api/seasons/<id>/generate-payouts/
GET /api/members/<member_id>/seasons/<season_id>/payout-statement/

GET/POST/PATCH/DELETE /api/announcements/
GET/POST/PATCH/DELETE /api/fertilizer-inventory/
GET/POST/PATCH/DELETE /api/fertilizer-requests/
POST /api/fertilizer-requests/<id>/approve/
POST /api/fertilizer-requests/<id>/reject/

POST /api/payments/mpesa/stk-callback/
```

## Local Setup

### 1. Clone the Repository

```powershell
git clone <repo-url>
cd Coffee_management_system
```

### 2. Backend Setup

Create and activate a virtual environment:

```powershell
python -m venv my_venv
my_venv\Scripts\activate
```

Install dependencies:

```powershell
cd backend\kaeve
pip install -r requirements.txt
```

Create a `.env` file in:

```txt
backend/kaeve/.env
```

Example local environment:

```env
DJANGO_DEBUG=True
DJANGO_SECRET_KEY=replace-this-locally
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CSRF_TRUSTED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

POSTGRES_DB=kaeve_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
USE_DATABASE_URL=False

FRONTEND_AUTH_REDIRECT_URL=http://localhost:5173
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=
MPESA_CALLBACK_BASE_URL=https://your-public-backend-url
```

Run migrations:

```powershell
python manage.py migrate
```

Start the backend:

```powershell
python manage.py runserver
```

The backend runs at:

```txt
http://127.0.0.1:8000
```

### 3. Frontend Setup

Open a second terminal:

```powershell
cd frontend
npm install
```

Create or update frontend `.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Do not add `/api` at the end. The frontend already calls `/api/...`.

Start the frontend:

```powershell
npm run dev
```

The frontend usually runs at:

```txt
http://localhost:5173
```

## Render Deployment

### Backend Web Service

Use the backend service for:

```txt
https://your-backend.onrender.com/api/...
https://your-backend.onrender.com/admin/
```

Recommended backend environment variables:

```env
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=
DJANGO_ALLOWED_HOSTS=your-backend.onrender.com,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://your-frontend.onrender.com
CSRF_TRUSTED_ORIGINS=https://your-frontend.onrender.com
DATABASE_URL=
USE_DATABASE_URL=True

FRONTEND_AUTH_REDIRECT_URL=https://your-frontend.onrender.com
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

MPESA_ENV=sandbox
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=174379
MPESA_PASSKEY=
MPESA_CALLBACK_BASE_URL=https://your-backend.onrender.com
```

Build/start command depends on your Render setup, but it should install requirements, run migrations, collect static if needed, and start Gunicorn.

### Frontend Static Site

Render Static Site settings:

```txt
Root Directory: frontend
Build Command: npm install && npm run build
Publish Directory: dist
```

Frontend environment variable:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
```

## M-Pesa Notes

For sandbox STK Push:

```env
MPESA_ENV=sandbox
MPESA_SHORTCODE=174379
MPESA_CALLBACK_BASE_URL=https://your-backend.onrender.com
```

The callback endpoint becomes:

```txt
https://your-backend.onrender.com/api/payments/mpesa/stk-callback/
```

In sandbox, the M-Pesa prompt may show Daraja/Safaricom test merchant details because the sandbox shortcode belongs to Daraja. In production, the prompt name comes from the registered PayBill/Till owner.

## Main Workflows

### Member Registration

1. User signs up or continues with Google.
2. If the profile is incomplete, the member completes cooperative details.
3. Member can set username/password for future login.
4. Member portal unlocks deliveries, loans, fertilizer, announcements, and payouts.

### Delivery to Inventory

1. Field officer or secretary records a delivery.
2. Delivery is linked to member, season, and collection point.
3. Cherry inventory increases automatically under the collection point warehouse.
4. Dashboard and reports reflect delivery totals.

### Milling

1. Admin/manager records a milling batch.
2. System checks total cherry available for the selected season.
3. Cherry stock reduces.
4. Parchment and green bean stock increase.
5. Outturn ratio is calculated.

### Loan and Repayment

1. Member applies for a loan.
2. System checks eligibility based on harvest history or guarantor rules.
3. Admin/manager approves or rejects.
4. Member can repay through M-Pesa STK Push.
5. Successful callback creates a repayment record.
6. Payout deducts only the remaining outstanding balance.

### Payout

1. Admin/manager selects a season.
2. System reads delivered kilograms and payout rate.
3. Loan deductions and other deductions are applied.
4. Net payout is generated.
5. Member can download a payout statement.

## Validation and Security

- Backend validates important rules even if frontend validation is bypassed.
- Protected endpoints require authentication.
- Role permissions prevent users from accessing unauthorized features.
- Members are scoped to their own records.
- Passwords are stored using Django password hashing.
- Secrets are read from environment variables and should never be committed.

## Useful Commands

Backend:

```powershell
cd backend\kaeve
python manage.py check
python manage.py makemigrations core --check --dry-run
python manage.py migrate
python manage.py runserver
```

Frontend:

```powershell
cd frontend
npm run build
npm run dev
```

Git:

```powershell
git status
git add .
git commit -m "Describe change"
git push
```

## Known Improvements

- Add full C2B PayBill reconciliation
- Add SMS notifications
- Add Swagger/OpenAPI documentation
- Add more automated tests for loan, payout, and M-Pesa edge cases
- Add advanced audit logs
- Add offline delivery recording for field officers
- Add richer production and financial analytics

## Project Status

The system currently supports the core cooperative workflow from registration and deliveries to milling, loans, M-Pesa repayments, inventory, fertilizer requests, announcements, and payouts.
