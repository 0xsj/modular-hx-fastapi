LANGUAGE = "nest"
"""Build and verify this clone's real foundations executable (no services required)."""
import errno
import json
import os
from pathlib import Path
import pty
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = Path(tempfile.mkdtemp(prefix="n2f-process-check-"))
ENV = os.environ.copy()
CONFIG_KEYS = ["SERVICE_NAME", "SERVICE_NAMESPACE", "SERVICE_VERSION", "APP_ENV",
               "LOG_FORMAT", "LOG_LEVEL", "LOG_COLOR", "LOG_CAPACITY", "LOG_MAX_BYTES",
               "LOG_FLUSH_MS", "DEMO_VERBOSE", "DEMO_TOKEN", "NO_COLOR"]
for key in CONFIG_KEYS:
    ENV.pop(key, None)
if LANGUAGE == "go":
    ENV.setdefault("GOCACHE", str(EVIDENCE / "go-cache"))
    command = [str(EVIDENCE / "foundations")]
    build = ["go", "build", "-o", command[0], "./cmd/foundations"]
elif LANGUAGE == "rs":
    ENV.setdefault("CARGO_TARGET_DIR", str(EVIDENCE / "target"))
    command = [str(Path(ENV["CARGO_TARGET_DIR"]) / "debug" / "foundations")]
    build = ["cargo", "build", "--offline", "--locked", "--bin", "foundations"]
else:
    command = ["node", str(ROOT / "dist" / "foundations.js")]
    build = ["pnpm", "run", "build"]
result = subprocess.run(build, cwd=ROOT, env=ENV, capture_output=True, text=True, timeout=120)
(EVIDENCE / "build.txt").write_text(result.stdout + result.stderr)
assert result.returncode == 0, "build failed: " + str(EVIDENCE)
reports = []

def run(name, settings, terminal=False):
    env = {**ENV, "DEMO_TOKEN": "fixture-only-process-SENTINEL", **settings}
    if terminal:
        master, slave = pty.openpty()
        chunks = []
        def read():
            while True:
                try:
                    chunk = os.read(master, 8192)
                    if not chunk:
                        break
                    chunks.append(chunk)
                except OSError as error:
                    if error.errno == errno.EIO:
                        break
                    raise
        proc = subprocess.Popen(command, cwd=ROOT, env=env, stdout=slave, stderr=subprocess.PIPE)
        os.close(slave)
        reader = threading.Thread(target=read)
        reader.start()
        _, diagnostic = proc.communicate(timeout=15)
        reader.join(timeout=2)
        os.close(master)
        assert not reader.is_alive()
        output, code = b"".join(chunks).decode(), proc.returncode
        diagnostic = diagnostic.decode()
    else:
        proc = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=15)
        output, diagnostic, code = proc.stdout, proc.stderr, proc.returncode
    assert "fixture-only-process-SENTINEL" not in output + diagnostic
    assert "credential-SENTINEL" not in output + diagnostic
    (EVIDENCE / (name + ".stdout")).write_text(output)
    (EVIDENCE / (name + ".stderr")).write_text(diagnostic)
    reports.append({"scenario": name, "exit": code})
    return output, diagnostic, code

output, diagnostic, code = run("json", {"LOG_FORMAT": "json"})
assert code == 0 and diagnostic == ""
records = [json.loads(line) for line in output.splitlines()]
events = {v["message"]: v for v in records}
assert len(records) == 7 and len(events) == 7
first, second = events["dependency.unavailable"]["scope"], events["work.completed"]["scope"]
for key in ["work_id", "correlation_id", "causation", "depth", "operation", "attribution"]:
    assert first[key] == second[key], key
assert first["scope_id"] != second["scope_id"]
assert second["previous_attempt"] == first["scope_id"] and second["attempt"] == 2
assert first["work_id"] != first["scope_id"]
startup = events["foundations.start"]["scope"]
assert first["causation"] == {"kind": "scope", "id": startup["scope_id"]}
assert first["correlation_id"] == startup["correlation_id"]
assert first["depth"] == 1 and startup["depth"] == 0
assert len({v["service"]["instance_id"] for v in records}) == 1
assert records[0]["service"]["instance_id"] != startup["scope_id"]
assert events["operation.unknown"]["error"] == {
    "classified": False, "kind": "internal",
    "public": {"kind": "internal", "message": "internal error"}, "has_cause": False}
assert events["dependency.unavailable"]["error"]["has_cause"] is True
assert events["operation.conflict"]["error"]["type"] == "demo.exists"
credential = events["foundations.start"]["fields"]["credential"]
assert credential == {"token": "[REDACTED]", "public": "visible"}
manifest = events["foundations.start"]["fields"]["config"]
assert [v["key"] for v in manifest] == sorted(v["key"] for v in manifest)
assert next(v for v in manifest if v["key"] == "DEMO_TOKEN") == {
    "key": "DEMO_TOKEN", "value": "[REDACTED]", "source": "environment", "secret": True}
summary = events["foundations.complete"]["fields"]
assert all(summary[k] == v for k, v in {"completed": 1, "refused": 1, "attempts": 2, "unknown": 1}.items())
assert summary["elapsed_ms"] >= 0
for record in records:
    assert isinstance(record["timestamp_ms"], int)
    assert record["level"] in ["info", "warn", "error"]
    assert "\x1b" not in json.dumps(record)

out, err, code = run("console", {"LOG_FORMAT": "console", "LOG_COLOR": "never"})
assert code == 0 and not err and len(out.splitlines()) == 7 and "\x1b" not in out
out, err, code = run("none", {"LOG_FORMAT": "none"})
assert code == 0 and not out and not err
out, err, code = run("debug", {"LOG_FORMAT": "json", "LOG_LEVEL": "debug", "DEMO_VERBOSE": "true"})
assert code == 0 and not err and "foundations.debug" in out
out, err, code = run("floor", {"LOG_FORMAT": "json", "LOG_LEVEL": "error", "DEMO_VERBOSE": "true"})
assert code == 0 and not err and [json.loads(v)["message"] for v in out.splitlines()] == ["operation.unknown"]
out, err, code = run("invalid", {"DEMO_TOKEN": "", "LOG_LEVEL": "rejected-PRIVATE", "LOG_CAPACITY": "-1"})
assert code == 2 and not out and "rejected-PRIVATE" not in err
assert all(key in err for key in ["DEMO_TOKEN", "LOG_LEVEL", "LOG_CAPACITY"])
out, err, code = run("empty_string", {"SERVICE_NAMESPACE": "", "LOG_FORMAT": "json"})
assert code == 0 and not err
manifest = json.loads(out.splitlines()[0])["fields"]["config"]
assert next(v for v in manifest if v["key"] == "SERVICE_NAMESPACE")["value"] == ""
out, err, code = run("color_always", {"LOG_COLOR": "always", "NO_COLOR": "1"})
assert code == 0 and not err and "\x1b[" in out
out, err, code = run("color_auto_pipe", {})
assert code == 0 and not err and "\x1b" not in out
out, err, code = run("color_auto_terminal", {}, terminal=True)
assert code == 0 and not err and "\x1b[" in out
out, err, code = run("color_no_color_terminal", {"NO_COLOR": "1"}, terminal=True)
assert code == 0 and not err and "\x1b" not in out
report = {"language": LANGUAGE, "scenarios": reports, "passed": len(reports)}
(EVIDENCE / "results.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"evidence": str(EVIDENCE), **report}))

