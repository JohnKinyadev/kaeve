# Coffee Management System - Render Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Deployment Steps](#deployment-steps)
3. [Environment Variables Setup](#environment-variables-setup)
4. [Database Setup](#database-setup)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:
- A Render account (free or paid) at https://render.com
- Your project pushed to GitHub
- A GitHub account connected to Render
- This repo linked to your Render account

---

## Deployment Steps

### Step 1: Create Services on Render

#### A. Create Backend Service (Django API)
1. Go to https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Fill in the form:
   - **Name**: `coffee-api` (or your preferred name)
   - **Environment**: `Python 3`
   - **Region**: Choose closest to users
   - **Branch**: `main` (or your branch)
   - **Build Command**: `cd backend/kaeve && pip install -r requirements.txt && python manage.py collectstatic --no-input && python manage.py migrate`
   - **Start Command**: `cd backend/kaeve && gunicorn kaeve.wsgi:application --bind 0.0.0.0:$PORT`
   - **Plan**: Select appropriate tier
5. Click **"Create Web Service"**

#### B. Create Database Service (PostgreSQL)
1. In Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Fill in:
   - **Name**: `coffee-db`
   - **Database**: `coffee_db` (or your name)
   - **User**: `coffee_user` (or your name)
   - **Region**: Same as backend
   - **PostgreSQL Version**: 15 or latest
3. Click **"Create Database"**
4. Copy the **Internal Database URL** (starts with `postgres://`)

#### C. Create Frontend Service (Node)
1. Click **"New +"** → **"Web Service"**
2. Fill in:
   - **Name**: `coffee-frontend`
   - **Environment**: `Node`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: `cd frontend && npm run preview`
3. Don't create yet (we need to add environment variable first)

### Step 2: Configure Environment Variables

#### For Backend Service:
1. Go to your `coffee-api` service
2. Click **"Environment"** tab
3. Add these environment variables:

```
DJANGO_SECRET_KEY = [Generate and paste here]
DJANGO_DEBUG = False
USE_DATABASE_URL = True
DATABASE_URL = [Paste the Internal Database URL from PostgreSQL]
DJANGO_ALLOWED_HOSTS = coffee-api.onrender.com,[your-domain.com]
CORS_ALLOWED_ORIGINS = https://coffee-frontend.onrender.com,https://[your-domain.com]
CSRF_TRUSTED_ORIGINS = https://coffee-frontend.onrender.com,https://[your-domain.com]
PYTHON_VERSION = 3.11
```

#### For Frontend Service:
1. Go to your `coffee-frontend` service settings
2. Click **"Environment"** tab
3. Add:

```
VITE_API_URL = https://coffee-api.onrender.com
NODE_VERSION = 18
```

### Step 3: Deploy

1. **Backend**: 
   - Go to your `coffee-api` service
   - Click **"Manual Deploy"** → **"Deploy latest commit"**
   - Wait for build to complete (5-15 minutes)
   - Check logs if there are errors

2. **Frontend**:
   - Go to your `coffee-frontend` service
   - Click **"Manual Deploy"** → **"Deploy latest commit"**
   - Wait for deployment

3. Once both are deployed, test:
   - Backend: `https://coffee-api.onrender.com/api/` (should show API root)
   - Frontend: `https://coffee-frontend.onrender.com/`

---

## Environment Variables Setup

### Generating DJANGO_SECRET_KEY

Run this command locally:
```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

Or in Python:
```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

Copy the generated key to the `DJANGO_SECRET_KEY` environment variable in Render.

### Database Connection String

When you create PostgreSQL on Render, it provides:
- **Internal Database URL**: Use this for services in the same Render account
- Format: `postgresql://user:password@host:port/database`

Use the **Internal Database URL** in `DATABASE_URL` for best performance.

---

## Database Setup

### Initial Migration

The build script automatically runs migrations. However, if you need to:

1. SSH into your backend service:
   - In Render dashboard, go to `coffee-api` service
   - Click **"Connect"** → Choose **"SSH"**
   - Run:
     ```bash
     python backend/kaeve/manage.py migrate
     python backend/kaeve/manage.py createsuperuser
     ```

2. Or run commands via Render Shell:
   - Click **"Shell"** tab
   - Run commands there

### Loading Initial Data

If you have fixtures (JSON data files), add to build command:
```bash
python manage.py loaddata fixture_name.json
```

---

## Post-Deployment

### 1. Test Backend
```bash
curl https://coffee-api.onrender.com/api/
```

### 2. Test Frontend
Visit `https://coffee-frontend.onrender.com/`

### 3. Monitor Logs
- Backend: Service → **Logs** tab
- Frontend: Service → **Logs** tab

### 4. Check Uptime
- Each service dashboard shows uptime status
- Enable Email Notifications if desired

---

## Troubleshooting

### Build Failed
- Check **Logs** tab in service
- Common issues:
  - Missing dependencies: Add to `requirements.txt`
  - Python version mismatch: Check `PYTHON_VERSION` env var
  - Node version: Check `NODE_VERSION` env var

### Database Connection Error
- Verify `DATABASE_URL` is correct
- Check database is running (PostgreSQL service status)
- Ensure `USE_DATABASE_URL = True`

### Frontend Can't Reach Backend
- Check `VITE_API_URL` is set correctly
- Verify backend service is running
- Check CORS settings in backend
- Browser console should show CORS errors if blocked

### Static Files Not Loading
- Run `python manage.py collectstatic --no-input`
- Check `STATIC_ROOT` and `STATIC_URL` in settings
- Verify WhiteNoise is in MIDDLEWARE

### 503 Service Unavailable
- Service is likely starting up
- Check logs for errors
- Restart service if stuck

---

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Django Deployment Guide](https://docs.djangoproject.com/en/6.0/howto/deployment/)
- [Vite Deployment Guide](https://vitejs.dev/guide/deployment.html)

---

## Support

For Render-specific issues: https://support.render.com
For Django issues: https://www.django-rest-framework.org/
For React/Vite issues: https://vitejs.dev/
