# Coffee Cooperative Management System

Full-stack system for managing coffee cooperative operations from member registration and cherry deliveries through milling, loans, payouts, and reports.

## Stack

- Backend: Django
- API: Django REST Framework, planned
- Frontend: React.js with Vite
- Database: PostgreSQL
- Auth: JWT, planned

## Backend

```powershell
my_venv\Scripts\activate
cd kaeve
pip install -r requirements.txt
python manage.py makemigrations
python manage.py migrate
python manage.py runserver
```

PostgreSQL settings are read from environment variables. Copy `kaeve/.env.example` when you are ready to configure the database.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend expects the API at `http://localhost:8000/api` by default.
