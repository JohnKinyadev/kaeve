# Kaeve API Endpoint Testing Guide

Base URL: `https://kaeve.onrender.com`

Use JSON bodies with:

```http
Content-Type: application/json
Authorization: Bearer <access_token>
```

Public endpoints do not need the `Authorization` header. Most `/api/...` endpoints require a Bearer access token.

## Folder: Root and Health

| Method | Endpoint | Body |
| --- | --- | --- |
| GET | `/` | none |
| GET | `/api/health/` | none |

## Folder: Auth - Custom Tokens

### POST `/api/auth/register/`

Public member registration.

Required body params:

```json
{
  "username": "new-member",
  "password": "Password123!"
}
```

Optional body params:

```json
{
  "email": "new-member@example.com",
  "role": "member"
}
```

Allowed `role`: `member` only.

### POST `/api/auth/admin-register/`

Admin only.

Required body params:

```json
{
  "username": "new-admin",
  "password": "Password123!"
}
```

Optional body params:

```json
{
  "email": "new-admin@example.com",
  "role": "admin"
}
```

Allowed `role` values: `admin`, `manager`, `field_officer`, `member`.

### POST `/api/auth/login/`

Public.

Required body params:

```json
{
  "username": "admin",
  "password": "password"
}
```

### POST `/api/auth/refresh/`

Public.

Required body params:

```json
{
  "refresh": "<refresh_token>"
}
```

### POST `/api/auth/logout/`

Public.

Required body params:

```json
{
  "refresh": "<refresh_token>"
}
```

### GET `/api/auth/me/`

Requires auth. Body: none.

## Folder: Auth - SimpleJWT

These endpoints are also enabled by the project.

### POST `/api/token/`

Required body params:

```json
{
  "username": "admin",
  "password": "password"
}
```

### POST `/api/token/refresh/`

Required body params:

```json
{
  "refresh": "<jwt_refresh_token>"
}
```

### POST `/api/token/verify/`

Required body params:

```json
{
  "token": "<jwt_access_or_refresh_token>"
}
```

## Folder: Dashboard and Reports

| Method | Endpoint | Body | Access |
| --- | --- | --- | --- |
| GET | `/api/dashboard-summary/` | none | admin, manager, field_officer |
| GET | `/api/active-collection-points/` | none | any authenticated role |
| GET | `/api/seasons/{season_id}/intake-report/` | none | admin, manager, field_officer |
| GET | `/api/members/{member_id}/seasons/{season_id}/payout-statement/` | none | any authenticated role, member can only view own statement |

### POST `/api/seasons/{season_id}/generate-payouts/`

Admin only.

Required body params: none.

## Folder: Members

Base resource: `/api/members/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/members/` |
| POST | `/api/members/` |
| GET | `/api/members/{id}/` |
| PUT | `/api/members/{id}/` |
| PATCH | `/api/members/{id}/` |
| DELETE | `/api/members/{id}/` |

POST and PUT required body params:

```json
{
  "membership_number": "KC100",
  "full_name": "Mary Njeri",
  "national_id": "98765432",
  "farm_size_acres": "3.25",
  "location": "Nyeri"
}
```

Optional body params:

```json
{
  "user": 1,
  "phone_number": "0712345678",
  "status": "active"
}
```

Allowed `status` values: `active`, `suspended`, `exited`.

Query params: `search`, `ordering`, `page`, `status`, `location`.

## Folder: Collection Points

Base resource: `/api/collection-points/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/collection-points/` |
| POST | `/api/collection-points/` |
| GET | `/api/collection-points/{id}/` |
| PUT | `/api/collection-points/{id}/` |
| PATCH | `/api/collection-points/{id}/` |
| DELETE | `/api/collection-points/{id}/` |

POST and PUT required body params:

```json
{
  "name": "Kiamumbi",
  "location": "Kiambu"
}
```

Optional body params:

```json
{
  "is_active": true
}
```

Query params: `search`, `ordering`, `page`, `is_active`, `location`.

## Folder: Seasons

Base resource: `/api/seasons/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/seasons/` |
| POST | `/api/seasons/` |
| GET | `/api/seasons/{id}/` |
| PUT | `/api/seasons/{id}/` |
| PATCH | `/api/seasons/{id}/` |
| DELETE | `/api/seasons/{id}/` |

POST and PUT required body params:

```json
{
  "name": "Main Crop 2026",
  "season_type": "main_crop",
  "start_date": "2026-06-18"
}
```

Optional body params:

```json
{
  "end_date": "2026-12-31",
  "is_active": true,
  "is_closed": false
}
```

Allowed `season_type` values: `main_crop`, `fly_crop`.

Query params: `search`, `ordering`, `page`, `season_type`, `is_active`, `is_closed`.

## Folder: Deliveries

Base resource: `/api/deliveries/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/deliveries/` |
| POST | `/api/deliveries/` |
| GET | `/api/deliveries/{id}/` |
| PUT | `/api/deliveries/{id}/` |
| PATCH | `/api/deliveries/{id}/` |
| DELETE | `/api/deliveries/{id}/` |

POST and PUT required body params:

```json
{
  "member": 1,
  "season": 1,
  "collection_point": 1,
  "weight_kg": "75.00"
}
```

Optional body params:

```json
{
  "delivery_date": "2026-06-18",
  "grade": "a",
  "notes": "Morning intake"
}
```

Allowed `grade` values: `a`, `b`, `pb`, `ungraded`.

Query params: `search`, `ordering`, `page`, `member`, `season`, `collection_point`, `grade`.

## Folder: Milling Batches

Base resource: `/api/milling-batches/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/milling-batches/` |
| POST | `/api/milling-batches/` |
| GET | `/api/milling-batches/{id}/` |
| PUT | `/api/milling-batches/{id}/` |
| PATCH | `/api/milling-batches/{id}/` |
| DELETE | `/api/milling-batches/{id}/` |

POST and PUT required body params:

```json
{
  "season": 1,
  "batch_number": "MB-001",
  "cherry_in_kg": "100.00"
}
```

Optional body params:

```json
{
  "parchment_out_kg": "22.00",
  "green_bean_out_kg": "18.00",
  "milled_on": "2026-06-18",
  "notes": "Batch notes"
}
```

Query params: `search`, `ordering`, `page`, `season`.

## Folder: Inventory Stocks

Base resource: `/api/inventory-stocks/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/inventory-stocks/` |
| POST | `/api/inventory-stocks/` |
| GET | `/api/inventory-stocks/{id}/` |
| PUT | `/api/inventory-stocks/{id}/` |
| PATCH | `/api/inventory-stocks/{id}/` |
| DELETE | `/api/inventory-stocks/{id}/` |

POST and PUT required body params:

```json
{
  "season": 1,
  "stock_type": "cherry",
  "warehouse": "Milling",
  "quantity_kg": "100.00"
}
```

Allowed `stock_type` values: `cherry`, `parchment`, `green_bean`.

Query params: `search`, `ordering`, `page`, `season`, `stock_type`, `warehouse`.

## Folder: Loans

Base resource: `/api/loans/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/loans/` |
| POST | `/api/loans/` |
| GET | `/api/loans/{id}/` |
| PUT | `/api/loans/{id}/` |
| PATCH | `/api/loans/{id}/` |
| DELETE | `/api/loans/{id}/` |
| POST | `/api/loans/{id}/approve/` |
| POST | `/api/loans/{id}/reject/` |

POST and PUT required body params:

```json
{
  "member": 1,
  "season": 1,
  "amount": "500.00"
}
```

Optional body params:

```json
{
  "reason": "Fertilizer",
  "status": "pending",
  "requested_on": "2026-06-18",
  "reviewed_by": 1
}
```

Allowed `status` values: `pending`, `approved`, `rejected`, `deducted`.

Approve/reject body params: none.

Query params: `search`, `ordering`, `page`, `member`, `season`, `status`.

## Folder: Sale Proceeds

Base resource: `/api/sale-proceeds/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/sale-proceeds/` |
| POST | `/api/sale-proceeds/` |
| GET | `/api/sale-proceeds/{id}/` |
| PUT | `/api/sale-proceeds/{id}/` |
| PATCH | `/api/sale-proceeds/{id}/` |
| DELETE | `/api/sale-proceeds/{id}/` |

POST and PUT required body params:

```json
{
  "season": 1,
  "buyer": "Auction Buyer",
  "quantity_kg": "100.00",
  "gross_amount": "10000.00"
}
```

Optional body params:

```json
{
  "sold_on": "2026-06-18",
  "expenses": "1000.00"
}
```

Query params: `search`, `ordering`, `page`, `season`.

## Folder: Payouts

Base resource: `/api/payouts/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/payouts/` |
| POST | `/api/payouts/` |
| GET | `/api/payouts/{id}/` |
| PUT | `/api/payouts/{id}/` |
| PATCH | `/api/payouts/{id}/` |
| DELETE | `/api/payouts/{id}/` |

POST and PUT required body params:

```json
{
  "member": 1,
  "season": 1,
  "delivered_kg": "75.00",
  "gross_share": "6000.00",
  "net_payable": "5500.00",
  "generated_by": 1
}
```

Optional body params:

```json
{
  "loan_deductions": "500.00",
  "other_deductions": "0.00"
}
```

Query params: `search`, `ordering`, `page`, `member`, `season`.

## Folder: Ledger Entries

Base resource: `/api/ledger-entries/`

Supported methods:

| Method | Endpoint |
| --- | --- |
| GET | `/api/ledger-entries/` |
| POST | `/api/ledger-entries/` |
| GET | `/api/ledger-entries/{id}/` |
| PUT | `/api/ledger-entries/{id}/` |
| PATCH | `/api/ledger-entries/{id}/` |
| DELETE | `/api/ledger-entries/{id}/` |

POST and PUT required body params:

```json
{
  "member": 1,
  "season": 1,
  "entry_type": "delivery",
  "description": "Delivery recorded"
}
```

Optional body params:

```json
{
  "amount": "0.00",
  "weight_kg": "75.00",
  "reference": "delivery:1"
}
```

Allowed `entry_type` values: `delivery`, `loan`, `payout`, `deduction`.

Query params: `search`, `ordering`, `page`, `member`, `season`, `entry_type`.

## Folder: Admin

| Method | Endpoint | Body |
| --- | --- | --- |
| GET | `/admin/` | none |

## Notes for PUT vs PATCH

Use `PUT` when sending the full object body for an update. Use `PATCH` when testing partial updates, for example:

```json
{
  "status": "suspended"
}
```

Read-only response fields such as `id`, display names, `created_at`, and `updated_at` should not be sent in request bodies.
