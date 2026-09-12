#!/usr/bin/env python3
"""Real diagnostic HTTP/outbound/WebSocket process checks for this clone."""
import base64, hashlib, http.server, json, os, pathlib, queue, socket, struct, subprocess, tempfile, threading, time, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1];LANG="go" if (ROOT/"go.mod").exists() else "rs" if (ROOT/"Cargo.toml").exists() else "nest"
TMP=pathlib.Path(os.environ.get("N2F_CHECK_TMP",tempfile.gettempdir()))
def run(args,env):
    p=subprocess.run(args,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=180)
    if p.returncode:raise RuntimeError(p.stdout[-6000:])
def exact(s,n):
    out=b""
    while len(out)<n:
        part=s.recv(n-len(out))
        if not part:raise EOFError("peer closed")
        out+=part
    return out
class WS:
    def __init__(self,port,origin="http://localhost:3000",protocol="n2f.v1",duplicate=False):
        self.s=socket.create_connection(("127.0.0.1",port),timeout=3);self.s.settimeout(3)
        key=base64.b64encode(os.urandom(16)).decode()
        lines=["GET /_examples/socket HTTP/1.1","Host: 127.0.0.1:"+str(port),"Upgrade: websocket","Connection: Upgrade","Sec-WebSocket-Version: 13","Sec-WebSocket-Key: "+key,"Sec-WebSocket-Protocol: "+protocol]
        if origin is not None:lines.append("Origin: "+origin)
        if duplicate:lines.append("Origin: "+origin)
        self.s.sendall(("\r\n".join(lines)+"\r\n\r\n").encode())
        header=b""
        while not header.endswith(b"\r\n\r\n"):header+=exact(self.s,1)
        self.status=int(header.split(b" ")[1])
        if self.status==101:
            accept=base64.b64encode(hashlib.sha1((key+"258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest())
            assert accept.lower() in header.lower()
    def send(self,op,body):
        if isinstance(body,str):body=body.encode()
        n=len(body);mask=os.urandom(4)
        head=bytes([128|op,128|(n if n<126 else 126 if n<=65535 else 127)])
        if n>=126:head+=struct.pack("!H" if n<=65535 else "!Q",n)
        self.s.sendall(head+mask+bytes(b^mask[i%4] for i,b in enumerate(body)))
    def recv(self):
        a,b=exact(self.s,2);n=b&127
        if n==126:n=struct.unpack("!H",exact(self.s,2))[0]
        if n==127:n=struct.unpack("!Q",exact(self.s,8))[0]
        assert n<=131072 and not b&128
        return a&15,exact(self.s,n)
    def message(self):
        while True:
            op,b=self.recv()
            if op==9:self.send(10,b);continue
            assert op==1,(op,b)
            return json.loads(b)
    def close(self):
        try:self.send(8,struct.pack("!H",1000))
        except OSError:pass
        self.s.close()
def main():
    propagated=[]
    class Upstream(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            assert self.path=="/probe"
            propagated.append(self.headers.get("traceparent"))
            self.send_response(409);self.send_header("Content-Length","2");self.end_headers();self.wfile.write(b"{}")
        def log_message(self,*args):pass
    upstream=http.server.ThreadingHTTPServer(("127.0.0.1",0),Upstream)
    threading.Thread(target=upstream.serve_forever,daemon=True).start()
    env={**os.environ,"DEMO_TOKEN":"fixture-SENTINEL","DATABASE_ENABLED":"false","HTTP_PORT":"0","LOG_FORMAT":"json","TELEMETRY_MODE":"none","SHUTDOWN_MS":"2000","OUTBOUND_ORIGIN":"http://127.0.0.1:"+str(upstream.server_port)}
    if os.environ.get("N2F_VERIFY_OTLP_ENDPOINT"):
        env.update(TELEMETRY_MODE="otlp",TELEMETRY_SAMPLING="all",TELEMETRY_ENDPOINT=os.environ["N2F_VERIFY_OTLP_ENDPOINT"],SERVICE_NAME="n2f-"+LANG+"-outbound-check")
    process=None;connections=[];lines=[];errlines=[]
    evidence={"language":LANG,"cases":[]}
    try:
        if LANG=="go":
            env["GOCACHE"]=str(TMP/"n2f-http-go-cache");binary=TMP/"n2f-transport-go";run(["go","build","-o",str(binary),"./cmd/http-example"],env);cmd=[str(binary)]
        elif LANG=="rs":
            target=os.environ.get("CARGO_TARGET_DIR",str(TMP/"n2f-http-rs"));run(["cargo","build","--offline","--locked","--target-dir",target,"--bin","http-example"],env);cmd=[str(pathlib.Path(target)/"debug/http-example")]
        else:run(["pnpm","run","build"],env);cmd=["node","dist/http-example.js"]
        process=subprocess.Popen(cmd,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        q=queue.Queue()
        def stderr():
            for line in process.stderr:errlines.append(line);q.put(line)
        def stdout():
            for line in process.stdout:lines.append(line)
        threading.Thread(target=stderr,daemon=True).start();threading.Thread(target=stdout,daemon=True).start()
        port=None;end=time.monotonic()+15
        while time.monotonic()<end:
            try:line=q.get(timeout=.2)
            except queue.Empty:
                if process.poll()is not None:raise AssertionError("startup: "+"".join(errlines))
                continue
            if line.startswith("http.listening "):port=int(line.rsplit(":",1)[1]);break
        assert port
        with urllib.request.urlopen("http://127.0.0.1:"+str(port)+"/_examples/outbound") as r:assert json.load(r)=={"status":409,"body_bytes":2}
        evidence["cases"].append("outbound_received_409")
        for origin,protocol,duplicate in [(None,"n2f.v1",False),("http://evil.invalid","n2f.v1",False),("http://localhost:3000","wrong",False),("http://localhost:3000","n2f.v1",True)]:
            w=WS(port,origin,protocol,duplicate);assert w.status==403,w.status;w.s.close()
        evidence["cases"].append("four_admission_refusals")
        w=WS(port);connections.append(w);assert w.status==101
        replies=[]
        for mid in ["one","two"]:
            w.send(1,json.dumps({"v":1,"id":mid,"type":"ping","payload":{"private":"fixture-SENTINEL"}}))
            reply=w.message();assert reply["v"]==1 and reply["id"]==mid and reply["type"]=="pong";replies.append(reply)
        assert replies[0]["payload"]["connection_id"]==replies[1]["payload"]["connection_id"]
        assert len({replies[0]["payload"]["connection_id"],replies[0]["payload"]["scope_id"],replies[1]["payload"]["scope_id"]})==3
        evidence["cases"].append("fresh_message_scopes")
        w.send(9,b"control");op,body=w.recv();assert op==10 and body==b"control"
        evidence["cases"].append("ping_pong_control")
        for opcode,body,code in [(1,b"{}",1008),(2,b"x",1003),(1,b"x"*65537,1009)]:
            bad=WS(port);connections.append(bad);bad.send(opcode,body)
            op,body=bad.recv();assert op==8 and len(body)>=2,(op,body)
            got=struct.unpack("!H",body[:2])[0];assert got==code,(got,code)
            bad.send(8,body);bad.s.close()
        evidence["cases"].append("malformed_binary_oversize")
        started=time.monotonic();process.terminate();op,body=w.recv();assert op==8 and struct.unpack("!H",body[:2])[0]==1001;w.send(8,body);w.s.close();process.wait(timeout=3)
        assert process.returncode==0
        evidence["shutdown_ms"]=round((time.monotonic()-started)*1000)
        evidence["cases"].append("shutdown_open_connection")
        joined="".join(lines);assert "SENTINEL" not in joined
        records=[json.loads(line) for line in lines if line.strip().startswith("{")]
        assert sum(r.get("message")=="socket.message.completed" for r in records)==2
        evidence["cases"].append("safe_message_logs")
        if os.environ.get("N2F_VERIFY_OTLP_ENDPOINT"):
            record=next(r for r in records if r.get("fields",{}).get("route")=="/_examples/outbound")
            ref=record["trace"];parts=propagated[0].split("-")
            assert parts[1]==ref["trace_id"] and parts[2]!=ref["span_id"] and parts[3]=="01"
            auth="Basic "+base64.b64encode(b"n2f:n2f_local").decode()
            def get(source,path,params=None):
                url=os.environ["N2F_VERIFY_GRAFANA"]+"/api/datasources/proxy/uid/"+source+path
                if params:url+="?"+urllib.parse.urlencode(params)
                with urllib.request.urlopen(urllib.request.Request(url,headers={"Authorization":auth}),timeout=5) as r:return json.load(r)
            def wait(check):
                end=time.monotonic()+45;last=None
                while time.monotonic()<end:
                    try:
                        value=check()
                        if value:return value
                    except Exception as e:last=str(e)
                    time.sleep(.5)
                raise AssertionError("stored outbound telemetry: "+str(last))
            def client_span():
                data=get("tempo","/api/traces/"+ref["trace_id"])
                spans=[s for b in data["batches"] for c in b["scopeSpans"] for s in c["spans"]]
                return next((s for s in spans if base64.b64decode(s["spanId"]).hex()==parts[2]),None)
            span=wait(client_span)
            assert span["kind"]=="SPAN_KIND_CLIENT" and base64.b64decode(span["parentSpanId"]).hex()==ref["span_id"]
            assert span["status"]["code"]=="STATUS_CODE_ERROR"
            attrs={a["key"]:next(iter(a["value"].values())) for a in span["attributes"]}
            assert attrs["http.request.method"]=="GET" and int(attrs["http.response.status_code"])==409 and attrs["error.type"]=="409"
            instance=record["service"]["instance_id"]
            metrics=wait(lambda:get("prometheus","/api/v1/query",{"query":'http_client_request_duration_seconds_count{service_instance_id="'+instance+'"}'})["data"]["result"])
            assert sum(float(s["value"][1]) for s in metrics)==1
            for s in metrics:
                assert not any(k in s["metric"] for k in ("url_full","url_path","trace_id","span_id","request_id"))
            assert "SENTINEL" not in json.dumps([span,metrics])
            evidence["cases"].append("stored_client_span_parent_and_duration")
        print(json.dumps(evidence,indent=2))
    finally:
        for w in connections:
            try:w.s.close()
            except OSError:pass
        if process and process.poll()is None:process.kill();process.wait()
        upstream.shutdown();upstream.server_close()
if __name__=="__main__":main()
