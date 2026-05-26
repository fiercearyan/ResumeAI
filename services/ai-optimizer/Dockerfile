FROM python:3.11-slim

WORKDIR /srv

# WeasyPrint system deps for PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
    libffi-dev shared-mime-info \
    fonts-dejavu fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8004
CMD ["sh", "-c", "if [ \"$OTEL_DISABLED\" = \"true\" ]; then uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload; else opentelemetry-instrument uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload; fi"]
