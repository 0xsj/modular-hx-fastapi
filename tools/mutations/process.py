"""Selected process-foundation mutations; every fault must compile before testing."""
CONFIG = {'copy': ['package.json',
          'pnpm-lock.yaml',
          'tsconfig.json',
          'tsconfig.build.json',
          'vitest.config.ts',
          'vitest.config.e2e.ts',
          'src',
          'test'],
 'build': ['node', 'node_modules/typescript/bin/tsc', '--noEmit'],
 'command': ['node', 'node_modules/vitest/vitest.mjs', 'run'],
 'language': 'n2f-nest',
 'mutants': [('secret',
              'json_discloses',
              'src/shared/secret/value.ts',
              "  toJSON(): string {\n    return '[REDACTED]';\n  }\n",
              '  toJSON(): string {\n    return this.#value;\n  }\n'),
             ('secret',
              'primitive_discloses',
              'src/shared/secret/value.ts',
              "  [Symbol.toPrimitive](): string {\n    return '[REDACTED]';\n  }\n",
              '  [Symbol.toPrimitive](): string {\n    return this.#value;\n  }\n'),
             ('env',
              'empty_becomes_absent',
              'src/shared/env/reader.ts',
              '  string(key: string, fallback: string): string {\n'
              '    const r = this.#read(key);\n'
              "    if (!r.valid) return '';\n"
              '    const v = r.value ?? fallback;\n'
              '    this.#record(key, v, r.value !== undefined);\n'
              '    return v;\n'
              '  }\n',
              '  string(key: string, fallback: string): string {\n'
              '    const r = this.#read(key);\n'
              "    if (!r.valid) return '';\n"
              '    const v = r.value || fallback;\n'
              '    this.#record(key, v, r.value !== undefined);\n'
              '    return v;\n'
              '  }\n'),
             ('env',
              'manifest_discloses',
              'src/shared/env/reader.ts',
              "value: secret ? '[REDACTED]' : value",
              'value: value'),
             ('env',
              'false_becomes_true',
              'src/shared/env/reader.ts',
              "v = r.value === 'true';",
              "v = r.value === 'false';"),
             ('provenance',
              'retry_skips_ordinal',
              'src/shared/provenance/factory.ts',
              's.attempt + 1',
              's.attempt + 0'),
             ('provenance',
              'child_loses_depth',
              'src/shared/provenance/factory.ts',
              'w.depth++;',
              'w.depth += 0;'),
             ('provenance',
              'cause_without_correlation',
              'src/shared/provenance/incoming.ts',
              'else if (correlation === undefined)',
              'else if (false)'),
             ('provenance',
              'collision_guard_removed',
              'src/shared/provenance/factory.ts',
              'forbidden.includes(scopeId)',
              '(forbidden.includes(scopeId) && false)'),
             ('logger',
              'exclusive_floor',
              'src/shared/logger/runtime.ts',
              'rank[severity] < rank[level.value]',
              'rank[severity] <= rank[level.value]'),
             ('logger',
              'noop_emits',
              'src/shared/logger/runtime.ts',
              "format === 'none' || rank[severity]",
              'rank[severity]'),
             ('logger',
              'ignores_no_color',
              'src/shared/logger/config.ts',
              'terminal && !noColor',
              'terminal'),
             ('logger',
              'queue_exceeds_capacity',
              'src/shared/logger/delivery.ts',
              'this.#queue.length >= this.capacity',
              'this.#queue.length > this.capacity'),
             ('logger',
              'cause_presence_inverted',
              'src/shared/logger/projection.ts',
              'causeOf(error) !== undefined',
              'causeOf(error) === undefined'),
             ('root', 'summary_loses_retry', 'src/root/demo.ts', 'attempts: 2', 'attempts: 1')]}

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

# This file is intentionally self-contained: it only reads its own clone.
ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = Path(tempfile.mkdtemp(prefix="n2f-process-mutations-"))
WORK = EVIDENCE / "work"
WORK.mkdir()
ENV = os.environ.copy()
ENV.update(NO_COLOR="1", CI="true", CARGO_TERM_COLOR="never")
ENV["CARGO_TARGET_DIR"] = str(EVIDENCE / "target")
ENV.setdefault("GOCACHE", str(EVIDENCE / "go-cache"))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

for relative in CONFIG["copy"]:
    source, target = ROOT / relative, WORK / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, target)
    else:
        shutil.copy2(source, target)
HASHES = {str(p.relative_to(WORK)): digest(p) for p in WORK.rglob("*") if p.is_file()}
if CONFIG["language"] == "n2f-nest":
    if not (ROOT / "node_modules").is_dir():
        raise SystemExit("Install this clone's locked dependencies first.")
    (WORK / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)

print(json.dumps({"evidence": str(EVIDENCE)}), flush=True)

def run(command, log):
    result = subprocess.run(command, cwd=WORK, env=ENV, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
    (EVIDENCE / log).write_text(result.stdout)
    return result

def cases(output):
    if CONFIG["language"] == "n2f-go":
        return re.findall(r"--- FAIL: (.+?) \(", output)
    if CONFIG["language"] == "n2f-rs":
        return re.findall(r"test (\w+) \.\.\. FAILED", output)
    if "AssertionError" not in output:
        return []
    return re.findall(r"^\s*FAIL\s+(.+)$", output, flags=re.MULTILINE)

build = run(CONFIG["build"], "baseline-build.txt")
baseline = run(CONFIG["command"], "baseline-test.txt")
if build.returncode or baseline.returncode:
    raise SystemExit("Baseline failed; inspect " + str(EVIDENCE))

results = []
for module, label, relative, old, new in CONFIG["mutants"]:
    path = WORK / relative
    original = path.read_bytes()
    text = original.decode()
    if text.count(old) != 1:
        raise SystemExit(f"{label}: mutation site count is {text.count(old)}, expected 1")
    test_exit, failures = None, []
    try:
        path.write_text(text.replace(old, new, 1))
        built = run(CONFIG["build"], label + "-build.txt")
        if built.returncode:
            outcome = "invalid"
        else:
            tested = run(CONFIG["command"], label + "-test.txt")
            test_exit, failures = tested.returncode, cases(tested.stdout)
            outcome = "survived" if test_exit == 0 else "killed" if failures else "harness_error"
    finally:
        path.write_bytes(original)
    result = dict(module=module, mutant=label, file=relative, before=old, after=new,
                  build_exit=built.returncode, test_exit=test_exit, outcome=outcome,
                  failing_cases=failures)
    results.append(result)
    print(json.dumps(result), flush=True)
    (EVIDENCE / "in-progress.json").write_text(json.dumps(results, indent=2) + "\n")

restored = run(CONFIG["command"], "restored-baseline-test.txt")
report = dict(language=CONFIG["language"], scope="hand-selected secret/env/provenance/logger/root faults",
              build_command=CONFIG["build"], test_command=CONFIG["command"],
              baseline_build_passed=build.returncode == 0, baseline_passed=baseline.returncode == 0,
              results=results, source_hashes=HASHES, restored_baseline_passed=restored.returncode == 0,
              workspace_unchanged=all(digest(ROOT / p) == sha for p, sha in HASHES.items()),
              copy_restored=all(digest(WORK / p) == sha for p, sha in HASHES.items()))
(EVIDENCE / "results.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: value for key, value in report.items() if key not in ("results", "source_hashes")}), flush=True)
if not (report["restored_baseline_passed"] and report["workspace_unchanged"] and report["copy_restored"]) or any(r["outcome"] != "killed" for r in results):
    raise SystemExit(1)
