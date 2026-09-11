"""Run selected mutations in temporary copies; preserve source and raw evidence."""
CONFIG = {'copy': ['package.json', 'tsconfig.json', 'vitest.config.ts', 'src'],
 'build': ['node', 'node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
 'command': ['node', 'node_modules/vitest/vitest.mjs', 'run', 'src/shared', '--reporter=verbose'],
 'mutants': [('clock',
              'wall_set_resets_elapsed',
              'src/shared/clock/clock.ts',
              'this.#wall = validMillis(wall);',
              'this.#wall = validMillis(wall);\n this.#elapsed = 0n;'),
             ('clock',
              'advance_loses_elapsed',
              'src/shared/clock/clock.ts',
              'this.#elapsed += BigInt(milliseconds) * 1000000n;',
              'this.#elapsed += 0n;'),
             ('id', 'parse_accepts_other_variants', 'src/shared/id/value.ts', '[89ab]', '[0-9a-f]'),
             ('id',
              'rollback_resets_timestamp',
              'src/shared/id/v7.ts',
              'ms > this.#last',
              'ms !== this.#last'),
             ('id',
              'counter_wraps_on_exhaustion',
              'src/shared/id/v7.ts',
              'if (this.#counter === 4095)',
              'if (false)'),
             ('id',
              'entropy_failure_commits_state',
              'src/shared/id/v7.ts',
              'const random = new Uint8Array(10);',
              'this.#last = ms;\n this.#counter = counter;\n const random = new Uint8Array(10);'),
             ('id', 'counter_seed_loses_guard_bit', 'src/shared/id/v7.ts', '& 0x07ff', '& 0x0fff'),
             ('id',
              'sequence_repeats_first_value',
              'src/shared/id/sequence.ts',
              'this.#ids[this.#next++]',
              'this.#ids[this.#next]')],
 'language': 'n2f-nest'}

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
EVIDENCE = Path(tempfile.mkdtemp(prefix="n2f-foundation-mutations-"))
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
report = dict(language=CONFIG["language"], scope="hand-selected clock/id faults and the Rust boxed-source extension",
              build_command=CONFIG["build"], test_command=CONFIG["command"],
              baseline_build_passed=build.returncode == 0, baseline_passed=baseline.returncode == 0,
              results=results, source_hashes=HASHES, restored_baseline_passed=restored.returncode == 0,
              workspace_unchanged=all(digest(ROOT / p) == sha for p, sha in HASHES.items()),
              copy_restored=all(digest(WORK / p) == sha for p, sha in HASHES.items()))
(EVIDENCE / "results.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({key: value for key, value in report.items() if key not in ("results", "source_hashes")}), flush=True)
if not (report["restored_baseline_passed"] and report["workspace_unchanged"] and report["copy_restored"]) or any(r["outcome"] != "killed" for r in results):
    raise SystemExit(1)
