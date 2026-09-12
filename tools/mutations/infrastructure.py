#!/usr/bin/env python3
"""Six selected behavioral mutations, isolated sources and disposable PostgreSQL."""
import hashlib,json,os,pathlib,shutil,subprocess,tempfile,uuid
ROOT=pathlib.Path(__file__).resolve().parents[2]
LANG="go" if (ROOT/"go.mod").exists() else "rs" if (ROOT/"Cargo.toml").exists() else "nest"
WORK=pathlib.Path(tempfile.mkdtemp(prefix="n2f-infrastructure-mutations-"));COPY=WORK/"repository"
shutil.copytree(ROOT,COPY,ignore=shutil.ignore_patterns(".git","node_modules","target","dist",".vite","coverage","notes"))
if (ROOT/"node_modules").exists():(COPY/"node_modules").symlink_to(ROOT/"node_modules",target_is_directory=True)
PORT={"go":18021,"rs":18022,"nest":18023}[LANG];PROJECT="n2f-mutation-"+LANG
env={**os.environ,"N2F_POSTGRES_PORT":str(PORT),"GOCACHE":str(pathlib.Path(tempfile.gettempdir())/"n2f-http-go-cache"),"CARGO_TARGET_DIR":str(WORK/"target")}
if LANG=="go":
    unit=["go","test","./pkg/validation","./pkg/pagination","./pkg/health","./pkg/events"]
    integration=["go","test","./pkg/events/postgres","-v"]
    cases=[
      ("report-overflow","unit","pkg/validation/validation.go","len(r.issues) == 32","len(r.issues) == 33"),
      ("wrong-cursor-anchor","unit","pkg/pagination/pagination.go","position(rows[n-1])","position(rows[0])"),
      ("drain-reopens","unit","pkg/health/health.go","g.state.Store(2)","g.state.Store(1)"),
      ("wrong-receipt-accepted","database","pkg/events/postgres/store.go","receipt.EventID != lease.Event.ID()","false"),
      ("stale-lease-accepted","database","pkg/events/postgres/store.go","lease=$2::uuid","$2::uuid IS NOT NULL"),
      ("consumer-effects-survive","database","pkg/events/postgres/store.go","sub.Rollback(ctx)","sub.Commit(ctx)"),
    ]
elif LANG=="rs":
    unit=["cargo","test","--offline","--locked","--test","input_spec","--test","health_spec","--test","events_spec"]
    integration=["cargo","test","--offline","--locked","--test","events_integration","--","--ignored"]
    cases=[
      ("report-overflow","unit","src/shared/validation/mod.rs","self.issues.len() == 32","self.issues.len() == 33"),
      ("wrong-cursor-anchor","unit","src/shared/pagination/mod.rs","rows.last()","rows.first()"),
      ("drain-reopens","unit","src/shared/health/mod.rs","self.state.store(2,","self.state.store(1,"),
      ("wrong-receipt-accepted","database","src/shared/events/postgres/mod.rs","r.durable && r.event_id == lease.event.id()","r.durable"),
      ("stale-lease-accepted","database","src/shared/events/postgres/mod.rs","lease=$2::uuid","$2::uuid IS NOT NULL"),
      ("consumer-effects-survive","database","src/shared/events/postgres/mod.rs","sub.rollback().await","sub.commit().await"),
    ]
else:
    unit=["pnpm","exec","vitest","run","src/shared/validation/input.spec.ts","src/shared/health/health.spec.ts","src/shared/events/events.spec.ts"]
    integration=["pnpm","exec","vitest","run","src/shared/events/postgres/integration.spec.ts"]
    cases=[
      ("report-overflow","unit","src/shared/validation/index.ts","this.#issues.size === 32","this.#issues.size === 33"),
      ("wrong-cursor-anchor","unit","src/shared/pagination/index.ts","position(items[items.length - 1])","position(items[0])"),
      ("drain-reopens","unit","src/shared/health/index.ts","this.#state = 'draining'","this.#state = 'serving'"),
      ("wrong-receipt-accepted","database","src/shared/events/postgres/store.ts","receipt.value.eventId === lease.event.id","true"),
      ("stale-lease-accepted","database","src/shared/events/postgres/store.ts","lease=$2::uuid","$2::uuid IS NOT NULL"),
      ("consumer-effects-survive","database","src/shared/events/postgres/store.ts","ROLLBACK TO SAVEPOINT n2f_consumer","SELECT 1"),
    ]
def command(args,cwd=ROOT,runenv=None):
    r=subprocess.run(args,cwd=cwd,env=runenv or env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
    if r.returncode:raise RuntimeError(str(args)+"\n"+r.stdout[-6000:])
    return r.stdout
def compose(*args):return command(["docker","compose","-p",PROJECT,*args])
def run(name,stage,container):
    local=dict(env)
    if stage=="database":
        database="mut_"+uuid.uuid4().hex[:12]
        command(["docker","exec",container,"psql","-U","n2f","-d","n2f","-c","CREATE DATABASE "+database])
        local["N2F_TEST_DATABASE_URL"]="postgres://n2f:n2f_local@127.0.0.1:"+str(PORT)+"/"+database
    else:local.pop("N2F_TEST_DATABASE_URL",None)
    r=subprocess.run(integration if stage=="database" else unit,cwd=COPY,env=local,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
    (WORK/(name+".log")).write_text(r.stdout)
    return r.returncode,r.stdout
results=[]
try:
    compose("up","-d","--wait","postgres");container=compose("ps","-q","postgres").strip()
    for stage in ["unit","database"]:
        code,_=run("baseline-"+stage,stage,container)
        assert code==0,("baseline failed",stage,str(WORK))
    for name,stage,path,before,after in cases:
        file=COPY/path;original=file.read_text();assert before in original,(name,"target missing")
        file.write_text(original.replace(before,after,1))
        try:code,output=run(name,stage,container)
        finally:file.write_text(original)
        assert code!=0,(name,"survived",str(WORK))
        assert not any(s in output for s in ["error[E","[build failed]","Transform failed","failed to compile"]),(name,"compile failure",str(WORK))
        assert any(s in output for s in ["FAIL","FAILED","failed"]),(name,"no behavioral failure")
        results.append({"name":name,"caught":True,"source_sha256":hashlib.sha256(original.encode()).hexdigest()})
    report={"language":LANG,"caught":len(results),"selected":len(cases),"exhaustive":False,"evidence":str(WORK),"cases":results}
    (WORK/"report.json").write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
finally:compose("down")
