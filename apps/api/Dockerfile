FROM python:3.12-slim

WORKDIR /app
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/api/app ./app
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# The API listens on 8000 (see entrypoint.sh). EXPOSE lets platforms like Railway
# auto-detect the target port for a generated public domain.
EXPOSE 8000

# entrypoint.sh runs Alembic + seed on Postgres, or defers to the app's SQLite
# startup path, then serves uvicorn.
CMD ["./entrypoint.sh"]
