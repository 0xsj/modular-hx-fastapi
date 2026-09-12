#!/usr/bin/env python3
"""Selected principal invariant mutations in isolated copies, with raw evidence."""
import hashlib,json,os,pathlib,re,shutil,subprocess,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
LANG="go" if (ROOT/"go.mod").exists() else "rs" if (ROOT/"Cargo.toml").exists() else "nest"
EVIDENCE=pathlib.Path(tempfile.mkdtemp(prefix="n2f-identity-mutations-"))
WORK=EVIDENCE/"work"
shutil.copytree(ROOT,WORK,ignore=shutil.ignore_patterns(".git","node_modules","target","dist","notes",".env","coverage"))
if LANG=="nest":(WORK/"node_modules").symlink_to(ROOT/"node_modules",target_is_directory=True)
ENV={**os.environ,"GOCACHE":"/private/tmp/n2f-http-go-cache","CARGO_TARGET_DIR":"/private/tmp/n2f-identity-mutations-rs","CARGO_TERM_COLOR":"never","NO_COLOR":"1"}
PATHS={"go":"internal/identity/domain/principal.go","rs":"src/domains/identity/domain/mod.rs","nest":"src/modules/identity/domain/principal.ts"}
COMMANDS={"go":["go","test","-count=1","./internal/identity/domain"],"rs":["cargo","test","--offline","--locked","--test","identity_domain_spec"],"nest":["pnpm","exec","vitest","run","src/modules/identity/domain"]}
MUTATIONS={
"go":[("stale_version","if expected != p.state.Version {","if false {"),("same_state","if status == p.state.Status {","if false {"),("version_increment","next.Version++","next.Version += 0"),("restore_history","return Principal{state: s}, nil","s.Version = 1; return Principal{state: s}, nil")],
"rs":[("stale_version","if expected != self.state.version {","if false {"),("same_state","if status == self.state.status {","if false {"),("version_increment","state.version += 1;","state.version += 0;"),("restore_history","Ok(Self { state })","Ok(Self { state: Snapshot { version: 1, ..state } })")],
"nest":[("stale_version","if (expected !== this.#state.version)","if (false)"),("same_state","if (status === this.#state.status)","if (false)"),("version_increment","version: this.#state.version + 1","version: this.#state.version + 0"),("restore_history","id: normalized.value","id: normalized.value, version: 1")]}
path=WORK/PATHS[LANG];original=path.read_text();source_hash=hashlib.sha256(original.encode()).hexdigest()
def run(name):
 p=subprocess.run(COMMANDS[LANG],cwd=WORK,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
 (EVIDENCE/(name+".log")).write_text(p.stdout);return p
assert run("baseline").returncode==0,str(EVIDENCE)
results=[]
for name,old,new in MUTATIONS[LANG]:
 assert old in original,(name,old)
 # Rust restore and transition share the expression; only mutate its first occurrence.
 path.write_text(original.replace(old,new,1))
 result=run(name)
 compiled=not re.search(r"error\[E\d+\]|error TS\d+|\[build failed\]|Transform failed|Failed to load",result.stdout)
 caught=result.returncode!=0 and compiled and ("FAIL" in result.stdout or "panicked at" in result.stdout)
 results.append({"name":name,"caught":caught,"compiled":compiled,"source_sha256":source_hash})
 path.write_text(original)
assert run("restored").returncode==0
assert hashlib.sha256((ROOT/PATHS[LANG]).read_bytes()).hexdigest()==source_hash,"original source changed"
report={"language":LANG,"caught":sum(r["caught"] for r in results),"selected":len(results),"exhaustive":False,"evidence":str(EVIDENCE),"cases":results}
(EVIDENCE/"report.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2));assert all(r["caught"] for r in results)
