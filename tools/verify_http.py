#!/usr/bin/env python3
"""Exercise the real diagnostic executable over HTTP. No sibling dependencies."""
import argparse, concurrent.futures, http.client, http.server, json, os, pathlib, queue, signal, subprocess, threading, time, urllib.request, tempfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument("--skip-build",action="store_true")
parser.add_argument("--mode",default="none")
parser.add_argument("--endpoint")
parser.add_argument("--sampling",default="all")
parser.add_argument("--evidence")
parser.add_argument("--recover-via")
args=parser.parse_args()
cache=pathlib.Path(os.environ.get("N2F_CHECK_TMP",tempfile.gettempdir()))
env=dict(os.environ,GOCACHE=os.environ.get("GOCACHE",str(cache/"n2f-http-go-cache")),CARGO_TARGET_DIR=os.environ.get("CARGO_TARGET_DIR",str(cache/"n2f-http-rs")))
if (ROOT/"go.mod").exists():
    build=["go","build","-o",str(cache/"n2f-http-go"),"./cmd/http-example"]
    command=["/private/tmp/n2f-http-go"]
elif (ROOT/"Cargo.toml").exists():
    build=["cargo","build","--offline","--locked","--bin","http-example"]
    command=[env["CARGO_TARGET_DIR"]+"/debug/http-example"]
else:
    build=["pnpm","run","build"]
    command=["node","dist/http-example.js"]
if not args.skip_build: subprocess.run(build,cwd=ROOT,env=env,check=True)
env.update(DEMO_TOKEN="credential-SENTINEL",HTTP_PORT="0",LOG_FORMAT="json",TELEMETRY_MODE=args.mode,TELEMETRY_SAMPLING=args.sampling,SERVICE_NAME=ROOT.name+"-http-verification",SHUTDOWN_MS="2500",HTTP_TEST_ROUTES="true",HTTP_TIMEOUT_MS="100")
if args.endpoint: env["TELEMETRY_ENDPOINT"]=args.endpoint
proxy=None;recovered=threading.Event();failed_exports=[];pre_recovery_ids=set()
if args.recover_via:
    class Forward(http.server.BaseHTTPRequestHandler):
        def log_message(self,*_):pass
        def do_POST(self):
            if self.headers.get("Transfer-Encoding","").lower()=="chunked":
                chunks=[]
                while True:
                    size=int(self.rfile.readline().split(b";",1)[0],16)
                    if size==0:
                        while self.rfile.readline()!=bytes((13,10)):pass
                        break
                    chunks.append(self.rfile.read(size));assert self.rfile.read(2)==bytes((13,10))
                body=b"".join(chunks)
            else:body=self.rfile.read(int(self.headers.get("Content-Length","0")))
            if not recovered.is_set():
                failed_exports.append(self.path);self.send_response(503);self.end_headers();return
            try:
                request=urllib.request.Request(args.recover_via+self.path,data=body,headers={"Content-Type":self.headers.get("Content-Type","application/x-protobuf"),**({"Content-Encoding":self.headers["Content-Encoding"]} if self.headers.get("Content-Encoding") else {})})
                with urllib.request.urlopen(request,timeout=2) as result:
                    payload=result.read();self.send_response(result.status);self.end_headers();self.wfile.write(payload)
            except Exception:self.send_response(503);self.end_headers()
    proxy=http.server.ThreadingHTTPServer(("127.0.0.1",0),Forward)
    threading.Thread(target=proxy.serve_forever,daemon=True).start()
    env["TELEMETRY_ENDPOINT"]="http://127.0.0.1:"+str(proxy.server_port)
process=subprocess.Popen(command,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
lines=[];diagnostics=[];ready=queue.Queue()
def read(stream,destination):
    for line in stream:
        destination.append(line)
        if line.startswith("http.listening "): ready.put(int(line.strip().rsplit(":",1)[1]))
for stream,dest in [(process.stdout,lines),(process.stderr,diagnostics)]:
    threading.Thread(target=read,args=(stream,dest),daemon=True).start()
try:
    try: port=ready.get(timeout=12)
    except queue.Empty: raise AssertionError("listener did not start: "+"".join(diagnostics))
    def request(path,method="GET",headers=(),body=None):
        conn=http.client.HTTPConnection("127.0.0.1",port,timeout=5)
        conn.putrequest(method,path)
        for key,value in headers:conn.putheader(key,value)
        if body is not None:conn.putheader("Content-Length",str(len(body)))
        conn.endheaders(body)
        response=conn.getresponse();data=response.read();result=(response.status,dict((k.lower(),v) for k,v in response.getheaders()),data)
        conn.close();return result
    count=0
    parents={}
    active_spans={}
    for name,status in [("success",200),("conflict",409),("unavailable",503),("unknown",500)]:
        actual,headers,body=request("/_examples/http/"+name);count+=1
        assert actual==status,(name,actual,body)
        value=json.loads(body)
        assert headers.get("x-request-id")
        pre_recovery_ids.add(headers["x-request-id"])
        if status!=200:
            assert value["status"]==status and value["request_id"]==headers["x-request-id"]
            assert headers["content-type"].startswith("application/problem+json")
        if name=="unknown":assert value["detail"]=="internal error" and "code" not in value and "fields" not in value
    if proxy:
        time.sleep(.7)
        assert failed_exports,"outage did not exercise an export"
        recovered.set()
    correlation="01900000-0000-7000-8000-000000000001"
    for headers,continued in [
        ((),False),
        ((("X-Correlation-ID",correlation),("X-Request-ID","forged")),True),
        ((("X-Correlation-ID","broken"),),False),
        ((("X-Correlation-ID",""),),False),
        ((("X-Correlation-ID",correlation),("X-Correlation-ID",correlation)),False),
    ]:
        status,h,b=request("/_examples/http/success",headers=headers);count+=1
        assert status==200 and (h["x-correlation-id"]==correlation)==continued
        assert h["x-request-id"]!="forged"
    status,h,b=request("/_examples/http/success",method="HEAD");count+=1
    assert status==200 and b==b""
    status,h,b=request("/_examples/http/success",method="POST");count+=1
    assert status==405 and h["allow"]=="GET, HEAD" and json.loads(b)["kind"]=="invalid"
    status,h,b=request("/missing?credential=credential-SENTINEL");count+=1
    assert status==404
    status,h,b=request("/_examples/http/success",headers=(("Content-Type","text/plain"),),body=b"x");count+=1
    assert status==415,(status,b)
    status,h,b=request("/_examples/http/success",headers=(("Content-Type","application/json"),),body=b"x"*(1048576+1));count+=1
    assert status==413,(status,b)
    slow=http.client.HTTPConnection("127.0.0.1",port,timeout=3)
    slow.putrequest("GET","/_examples/http/success")
    slow.putheader("Content-Type","application/json");slow.putheader("Content-Length","10");slow.endheaders(b"{")
    response=slow.getresponse();body=response.read();count+=1;slow.close()
    assert response.status==408 and json.loads(body)["status"]==408,(response.status,body)
    for path,expected in [("panic",500),("delay",503),("context",200)]:
        status,h,b=request("/_examples/http/"+path);count+=1
        assert status==expected,(path,status,b)
        if path=="context":
            result=json.loads(b);assert result["before"]==h["x-request-id"]==result["after"]
    conn=http.client.HTTPConnection("127.0.0.1",port,timeout=5)
    conn.request("GET","/_examples/http/delay")
    time.sleep(.03);conn.close();count+=1
    time.sleep(.15)
    parent_trace="12345678901234567890123456789012";parent_span="1234567890123456"
    traceparent="00-"+parent_trace+"-"+parent_span+"-00"
    for headers,continued in [
        ((("traceparent",traceparent),),True),
        ((("traceparent",traceparent),("tracestate","invalid==value")),True),
        ((("traceparent",traceparent),("traceparent",traceparent)),False),
        ((("traceparent","broken"),),False),
        ((("traceparent",traceparent),("X-Correlation-ID","broken")),True),
    ]:
        status,h,b=request("/_examples/http/success",headers=headers);count+=1
        assert status==200
        parents[h["x-request-id"]]=continued
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        replies=list(pool.map(lambda _:request("/_examples/http/context"),range(24)));count+=24
    ids=[h["x-request-id"] for _,h,_ in replies];assert len(set(ids))==24
    for status,h,b in replies:
        v=json.loads(b);assert status==200 and v["before"]==h["x-request-id"]==v["after"]
        if args.mode=="otlp":
            assert v.get("trace_before") and v["trace_before"]==v["trace_after"]
            active_spans[h["x-request-id"]]=v["trace_before"]
    time.sleep(0.2)
finally:
    started=time.monotonic()
    process.send_signal(signal.SIGTERM)
    try:process.wait(timeout=4)
    except subprocess.TimeoutExpired:
        process.kill();process.wait();raise AssertionError("shutdown exceeded budget")
    shutdown_ms=(time.monotonic()-started)*1000
    if proxy:proxy.shutdown();proxy.server_close()
assert process.returncode==0,diagnostics
records=[json.loads(line) for line in lines]
completed=[v for v in records if v.get("message")=="http.request.completed"]
assert len(completed)==count,(len(completed),count,diagnostics)
assert "credential-SENTINEL" not in "".join(lines+diagnostics)
assert all(v["scope"]["executor"]["kind"]=="service" for v in completed)
assert all(v["scope"]["attribution"]["initiator"]["kind"]=="anonymous" for v in completed)
assert all(v["fields"]["elapsed_ms"]>=0 for v in completed)
if args.mode=="none":assert all("trace" not in v for v in completed)
else:
    assert all("trace" in v for v in completed)
    assert all(v["trace"]["sampled"]==(args.sampling=="all") for v in completed)
    for v in completed:
        request_id=v["scope"]["scope_id"]
        if request_id in active_spans:assert v["trace"]["span_id"]==active_spans[request_id]
        if request_id in parents:
            assert (v["trace"]["trace_id"]==parent_trace)==parents[request_id]
            assert v["trace"]["span_id"]!=parent_span
terminations=[v["fields"]["termination"] for v in completed]
assert "peer_closed" in terminations and "deadline" in terminations,terminations
for overrides in [
    {"HTTP_PORT":"-1"}, {"TELEMETRY_BATCH":"257"}, {"TELEMETRY_MODE":"broken"},
    {"TELEMETRY_ENDPOINT":"http://user:credential-SENTINEL@localhost:4318"},
    {"TELEMETRY_TIMEOUT_MS":"0"}, {"HTTP_TEST_ROUTES":"maybe"},
]:
    invalid=subprocess.run(command,cwd=ROOT,env={**env,**overrides},capture_output=True,text=True,timeout=4)
    assert invalid.returncode==2 and "http.listening" not in invalid.stderr
    assert "credential-SENTINEL" not in invalid.stdout+invalid.stderr
if args.evidence:pathlib.Path(args.evidence).write_text(json.dumps({"records":completed,"delivery_records":[r for r in completed if not proxy or r["scope"]["scope_id"] not in pre_recovery_ids],"diagnostics":diagnostics,"failed_export_requests":len(failed_exports)}))
print(json.dumps({"repository":ROOT.name,"requests":count,"completion_logs":len(completed),"shutdown_ms":round(shutdown_ms),"mode":args.mode,"result":"passed"}))
