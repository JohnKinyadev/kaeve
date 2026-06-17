#!/bin/bash
# Start script for Render deployment

set -e

# Run migrations on startup
python manage.py migrate

# Start gunicorn server
exec gunicorn kaeve.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 60
