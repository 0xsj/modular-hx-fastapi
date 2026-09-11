#!/usr/bin/env python3
"""Send synthetic OTLP signals to local infrastructure; no application SDK is used."""
import argparse
import json
import secrets
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint", required=True, help="OTLP HTTP base URL, without /v1/traces")
    parser.add_argument("--service", required=True, help="Blueprint name; -infra-smoke is appended")
    args = parser.parse_args()
    endpoint = args.endpoint.rstrip("/")
    service = args.service + "-infra-smoke"
    trace_id, span_id = secrets.token_hex(16), secrets.token_hex(8)
    now = time.time_ns()
    resource = {"attributes": [
        {"key": "service.name", "value": {"stringValue": service}},
        {"key": "service.namespace", "value": {"stringValue": "n2f"}},
        {"key": "deployment.environment.name", "value": {"stringValue": "development"}},
    ]}
    scope = {"name": "n2f.infrastructure.smoke", "version": "1"}
    message = "n2f infrastructure smoke: log linked to synthetic trace"
    payloads = {
        "traces": {"resourceSpans": [{"resource": resource, "scopeSpans": [{
            "scope": scope, "spans": [{
                "traceId": trace_id, "spanId": span_id, "name": "infra.smoke",
                "kind": 1, "startTimeUnixNano": str(now - 1_000_000),
                "endTimeUnixNano": str(now), "status": {"code": 1},
            }],
        }]}]},
        "logs": {"resourceLogs": [{"resource": resource, "scopeLogs": [{
            "scope": scope, "logRecords": [{
                "timeUnixNano": str(now), "observedTimeUnixNano": str(now),
                "severityNumber": 9, "severityText": "INFO",
                "body": {"stringValue": message}, "traceId": trace_id, "spanId": span_id,
            }],
        }]}]},
        "metrics": {"resourceMetrics": [{"resource": resource, "scopeMetrics": [{
            "scope": scope, "metrics": [{
                "name": "n2f.infra.smoke", "description": "Synthetic local infrastructure probe",
                "unit": "1", "gauge": {"dataPoints": [{"timeUnixNano": str(now), "asInt": "1"}]},
            }],
        }]}]},
    }
    for signal, payload in payloads.items():
        request = Request(
            endpoint + "/v1/" + signal, data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            with urlopen(request, timeout=10) as response:
                body = json.loads(response.read() or b"{}")
        except (HTTPError, URLError, TimeoutError) as exc:
            raise SystemExit(f"{signal} export failed: {exc}") from exc
        if body.get("partialSuccess"):
            raise SystemExit(f"{signal} export was only partially accepted: {body['partialSuccess']}")
    print(json.dumps({
        "service": service, "trace_id": trace_id, "span_id": span_id,
        "metric": "n2f_infra_smoke_ratio", "log": message,
        "result": "Collector accepted all three signals; verify retrieval in Grafana.",
    }, indent=2))


if __name__ == "__main__":
    main()

