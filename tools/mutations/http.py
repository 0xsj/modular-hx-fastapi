#!/usr/bin/env python3
"""Selected HTTP/telemetry mutations in isolated copies; no exhaustive score."""
import hashlib,json,os,pathlib,shutil,subprocess,tempfile
ROOT=pathlib.Path(__file__).resolve().parents[2]
work=pathlib.Path(tempfile.mkdtemp(prefix="n2f-http-mutations-"))
copy=work/"repository"
shutil.copytree(ROOT,copy,ignore=shutil.ignore_patterns(".git","node_modules","target","dist",".vite","coverage","notes"))
if (ROOT/"node_modules").exists(): (copy/"node_modules").symlink_to(ROOT/"node_modules",target_is_directory=True)
env=dict(os.environ,GOCACHE=os.environ.get("GOCACHE",str(pathlib.Path(tempfile.gettempdir())/"n2f-http-go-cache")),CARGO_TARGET_DIR=str(work/"target"))
if (ROOT/"go.mod").exists():
    command=["go","test","./pkg/http","./pkg/telemetry","./pkg/logger"]
    cases=[
      ("zero-is-success","pkg/telemetry/outcome.go","Success Outcome = iota + 1","Success Outcome = iota"),
      ("duplicate-completion","pkg/http/lifecycle.go","if a.done {","if false {"),
      ("omit-trace-envelope","pkg/logger/handler.go",'[]string{"scope", "error", "trace"}','[]string{"scope", "error"}'),
      ("omit-problem-status","pkg/http/problem.go",'json:"status"','json:"Status"'),
    ]
elif (ROOT/"Cargo.toml").exists():
    command=["cargo","test","--offline","--locked","--test","http_regression","--test","http_lifecycle","--test","logger_spec"]
    cases=[
      ("absence-becomes-failure","src/shared/http/problem.rs","let mut i = failure?.clone();","let mut i = failure.cloned().unwrap_or_else(|| crate::shared::errors::public_info(None));"),
      ("duplicate-completion","src/shared/http/lifecycle.rs","if self.done {","if false {"),
      ("omit-trace-envelope","src/shared/logger/runtime.rs",'record["trace"] = t.clone();','record["discarded_trace"] = t.clone();'),
      ("coarse-status-error","src/shared/http/policy.rs","s.to_string()",'String::from("5xx")'),
    ]
else:
    command=["pnpm","exec","vitest","run","src/shared/http","src/shared/telemetry","src/shared/logger"]
    cases=[
      ("success-becomes-failure","src/shared/http/problem.ts","if (result.ok) return undefined;","if (result.ok) return {} as Problem;"),
      ("duplicate-completion","src/shared/http/lifecycle.ts","if (this.#done) return ok(false);","if (false) return ok(false);"),
      ("omit-trace-envelope","src/shared/logger/runtime.ts","...(trace ? { trace } : {}),","...(trace ? { discarded_trace: trace } : {}),"),
      ("coarse-status-error","src/shared/http/policy.ts","String(f.status)",'"5xx"'),
    ]
def run(name):
    result=subprocess.run(command,cwd=copy,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=180)
    (work/(name+".log")).write_text(result.stdout)
    return result.returncode
assert run("baseline")==0,"baseline failed: "+str(work)
results=[]
for name,path,before,after in cases:
    file=copy/path;original=file.read_text()
    assert before in original,(name,"mutation target missing")
    file.write_text(original.replace(before,after,1))
    try: code=run(name)
    finally:file.write_text(original)
    assert code!=0,(name,"survived",str(work))
    output=(work/(name+".log")).read_text()
    assert any(marker in output for marker in ("FAIL","FAILED","failed")),(name,"not a behavioral failure")
    results.append({"name":name,"caught":True,"source_sha256":hashlib.sha256(original.encode()).hexdigest()})
(work/"report.json").write_text(json.dumps(results,indent=2))
print(json.dumps({"repository":ROOT.name,"selected":len(results),"caught":len(results),"evidence":str(work),"exhaustive":False}))
