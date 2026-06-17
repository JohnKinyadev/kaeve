# Render Deployment Guide - Environment Variables

## Backend (Django) Environment Variables

### Required for Production:
- **DJANGO_SECRET_KEY**: A secure secret key for Django (generate new one)
- **DJANGO_DEBUG**: Set to "False" for production
- **DATABASE_URL**: PostgreSQL connection string (provided by Render PostgreSQL)
- **USE_DATABASE_URL**: Set to "True"
- **DJANGO_ALLOWED_HOSTS**: Your Render domain (e.g., your-app.onrender.com)

### Security & CORS:
- **CORS_ALLOWED_ORIGINS**: Comma-separated list of allowed origins
  - Example: `https://your-frontend.onrender.com,https://yourdomain.com`
- **CSRF_TRUSTED_ORIGINS**: Comma-separated list of trusted origins
  - Example: `https://your-frontend.onrender.com,https://yourdomain.com`

### Optional but Recommended:
- **SECURE_SSL_REDIRECT**: Set to "True" (for HTTPS)
- **SESSION_COOKIE_SECURE**: Set to "True"
- **CSRF_COOKIE_SECURE**: Set to "True"

## Frontend (React) Environment Variables

### Production:
- **VITE_API_URL**: Backend API URL
  - Example: `https://coffee-api.onrender.com`

## Setting Environment Variables on Render

1. Go to your Service Settings on Render Dashboard
2. Navigate to "Environment"
3. Add each variable with its value
4. For DATABASE_URL: This is auto-populated when you create a PostgreSQL database

## How to Generate DJANGO_SECRET_KEY

In Python terminal:
```python
from django.core.management.utils import get_random_secret_key
print(get_random_secret_key())
```

Or use an online generator (be careful with production secrets):
```bash
python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

## Migration and Data Setup

The build script automatically runs migrations on deployment.
For initial data, you may need to:

1. SSH into the service
2. Run: `python manage.py createsuperuser` (if needed)
3. Or create a data fixture and load it during build
