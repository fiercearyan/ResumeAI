FROM python:3.11-slim

WORKDIR /srv

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model to avoid first-request latency.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

COPY app ./app

EXPOSE 8003
# opentelemetry-instrument auto-wires FastAPI/httpx/requests at startup.
# Falls back to plain uvicorn when OTEL_DISABLED=true.
CMD ["sh", "-c", "if [ \"$OTEL_DISABLED\" = \"true\" ]; then uvicorn app.main:app --host 0.0.0.0 --port 8003; else opentelemetry-instrument uvicorn app.main:app --host 0.0.0.0 --port 8003; fi"]
