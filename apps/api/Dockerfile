FROM python:3.12-slim

WORKDIR /app
COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/api/app ./app
COPY apps/api/alembic ./alembic
COPY apps/api/alembic.ini ./alembic.ini
COPY apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Run Alembic migrations (and seed once) before serving so the Postgres stack
# comes up with a fully-provisioned schema and canonical data.
CMD ["./entrypoint.sh"]
