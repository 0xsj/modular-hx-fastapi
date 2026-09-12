#!/usr/bin/env python3
"""Verify this clone against an owned temporary PostgreSQL 18 service."""
import json, os, pathlib, queue, re, subprocess, tempfile, threading, time, urllib.request, urllib.error, uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
LANG="go" if (ROOT/"go.mod").exists() else "rs" if (ROOT/"Cargo.toml").exists() else "nest"
TMP=pathlib.Path(os.environ.get("N2F_CHECK_TMP",tempfile.gettempdir()))
PROJECT="n2f-check-"+LANG
PORT={"go":17921,"rs":17922,"nest":17923}[LANG]
ENV={**os.environ,"N2F_POSTGRES_PORT":str(PORT)}
def run(args,env=None,timeout=180):
    result=subprocess.run(args,cwd=ROOT,env=env or ENV,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=timeout)
    if result.returncode: raise RuntimeError("command failed: "+str(args)+"\n"+result.stdout[-8000:])
    return result.stdout
def compose(*args):return run(["docker","compose","-p",PROJECT,*args])
def get(port,path):
    try:
        with urllib.request.urlopen("http://127.0.0.1:"+str(port)+path,timeout=2) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
def eventually(fn,want,seconds=10):
    end=time.monotonic()+seconds
    while time.monotonic()<end:
        try:
            value=fn()
            if value[0]==want:return value
        except (OSError,ValueError):pass
        time.sleep(.1)
    raise AssertionError("expected status "+str(want))
def main():
    process=None
    evidence={"language":LANG,"postgres":False,"health":[]}
    try:
        compose("up","-d","--wait","postgres")
        container=compose("ps","-q","postgres").strip()
        name="check_"+uuid.uuid4().hex[:12]
        run(["docker","exec",container,"psql","-U","n2f","-d","n2f","-c","CREATE DATABASE "+name])
        database="postgres://n2f:n2f_local@127.0.0.1:"+str(PORT)+"/"+name
        env={**ENV,"N2F_TEST_DATABASE_URL":database}
        if LANG=="go":
            env["GOCACHE"]=str(TMP/"n2f-http-go-cache")
            run(["go","test","-race","./pkg/postgres","-v"],env)
            binary=TMP/"n2f-infra-go"
            run(["go","build","-o",str(binary),"./cmd/http-example"],env)
            command=[str(binary)]
        elif LANG=="rs":
            target=os.environ.get("CARGO_TARGET_DIR",str(TMP/"n2f-http-rs"))
            run(["cargo","test","--offline","--locked","--target-dir",target,"--test","postgres_integration","--","--ignored"],env)
            run(["cargo","build","--offline","--locked","--target-dir",target,"--bin","http-example"],env)
            command=[str(pathlib.Path(target)/"debug/http-example")]
        else:
            run(["pnpm","exec","vitest","run","src/shared/postgres/integration.spec.ts"],env)
            run(["pnpm","run","build"],env)
            command=["node","dist/http-example.js"]
        evidence["postgres"]=True
        event_name="events_"+uuid.uuid4().hex[:12]
        run(["docker","exec",container,"psql","-U","n2f","-d","n2f","-c","CREATE DATABASE "+event_name])
        event_env={**env,"N2F_TEST_DATABASE_URL":"postgres://n2f:n2f_local@127.0.0.1:"+str(PORT)+"/"+event_name}
        if LANG=="go":run(["go","test","-race","./pkg/events/postgres","-v"],event_env)
        elif LANG=="rs":run(["cargo","test","--offline","--locked","--target-dir",target,"--test","events_integration","--","--ignored"],event_env)
        else:run(["pnpm","exec","vitest","run","src/shared/events/postgres/integration.spec.ts"],event_env)
        evidence["events"]=True
        demo_name="demo_"+uuid.uuid4().hex[:12]
        run(["docker","exec",container,"psql","-U","n2f","-d","n2f","-c","CREATE DATABASE "+demo_name])
        demo_env={**env,"DATABASE_URL":"postgres://n2f:n2f_local@127.0.0.1:"+str(PORT)+"/"+demo_name,"DEMO_TOKEN":"fixture-SENTINEL","LOG_FORMAT":"json"}
        if LANG=="go":
            demo_binary=TMP/"n2f-events-go"
            run(["go","build","-o",str(demo_binary),"./cmd/events-example"],demo_env)
            demo_command=[str(demo_binary)]
        elif LANG=="rs":
            run(["cargo","build","--offline","--locked","--target-dir",target,"--bin","events-example"],demo_env)
            demo_command=[str(pathlib.Path(target)/"debug/events-example")]
        else:demo_command=["node","dist/events-example.js"]
        demo_output=run(demo_command,demo_env,timeout=20)
        records=[json.loads(line) for line in demo_output.splitlines() if line.startswith("{")]
        assert sum(r.get("message")=="events.example.completed" for r in records)==1
        assert "SENTINEL" not in demo_output and demo_env["DATABASE_URL"] not in demo_output
        evidence["events_process"]=True
        env.update(DEMO_TOKEN="fixture-SENTINEL",DATABASE_ENABLED="true",DATABASE_URL=database,DATABASE_TIMEOUT_MS="200",HTTP_PORT="0",HTTP_TIMEOUT_MS="1000",LOG_FORMAT="json",TELEMETRY_MODE="none",SHUTDOWN_MS="2000")
        process=subprocess.Popen(command,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        lines=[];errors=queue.Queue()
        def readerr():
            for line in process.stderr:errors.put(line)
        def readout():
            for line in process.stdout:lines.append(line)
        threading.Thread(target=readerr,daemon=True).start();threading.Thread(target=readout,daemon=True).start()
        end=time.monotonic()+15;port=None
        while time.monotonic()<end:
            try:line=errors.get(timeout=.2)
            except queue.Empty:
                if process.poll() is not None:raise AssertionError("server exited before listening")
                continue
            match=re.search(r"http.listening .*:(\d+)",line)
            if match:port=int(match.group(1));break
        assert port is not None,"no listener"
        assert eventually(lambda:get(port,"/livez"),200)[1]=={"status":"alive"}
        assert eventually(lambda:get(port,"/readyz"),200)[1]=={"status":"ready"}
        evidence["health"]+=["live","ready"]
        compose("stop","-t","1","postgres")
        assert eventually(lambda:get(port,"/readyz"),503)[1]["code"]=="health.not_ready"
        assert get(port,"/livez")== (200,{"status":"alive"})
        evidence["health"]+=["database_down_not_ready","database_down_alive"]
        compose("up","-d","--wait","postgres")
        assert eventually(lambda:get(port,"/readyz"),200)[1]=={"status":"ready"}
        evidence["health"].append("database_recovered_ready")
        started=time.monotonic();process.terminate();process.wait(timeout=3)
        assert process.returncode==0
        evidence["shutdown_ms"]=round((time.monotonic()-started)*1000)
        assert "SENTINEL" not in "".join(lines) and database not in "".join(lines)
        evidence["redaction"]=True
        print(json.dumps(evidence,indent=2))
    finally:
        if process and process.poll() is None:process.kill();process.wait()
        compose("down")
if __name__=="__main__":main()
