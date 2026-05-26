"""Sentry init for Python services.

OTel is wired via the `opentelemetry-instrument` CLI wrapper in the Dockerfile
so no Python code is needed for tracing.

Sentry is opt-in: setting SENTRY_DSN turns it on; no DSN -> no-op.
"""
import os
import re
import sentry_sdk

_SENSITIVE_KEY_RE = re.compile(r"(password|token|secret|api[_-]?key|stripe-signature)", re.I)


def init_sentry(service_name: str) -> None:
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return

    def before_send(event, hint):
        # Scrub sensitive request data + extras.
        if event.get("request") and event["request"].get("headers"):
            event["request"]["headers"] = {
                k: ("[scrubbed]" if k.lower() in {"authorization", "cookie", "x-api-key"} else v)
                for k, v in event["request"]["headers"].items()
            }

        def deep_scrub(obj):
            if isinstance(obj, dict):
                return {k: ("[scrubbed]" if _SENSITIVE_KEY_RE.search(k) else deep_scrub(v)) for k, v in obj.items()}
            if isinstance(obj, list):
                return [deep_scrub(x) for x in obj]
            return obj

        if event.get("extra"):
            event["extra"] = deep_scrub(event["extra"])
        if event.get("request") and event["request"].get("data"):
            event["request"]["data"] = deep_scrub(event["request"]["data"])
        return event

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("NODE_ENV", "development"),
        release=os.environ.get("SERVICE_VERSION", "0.4.0"),
        server_name=service_name,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        before_send=before_send,
    )
    print(f"[sentry] enabled for {service_name}")
