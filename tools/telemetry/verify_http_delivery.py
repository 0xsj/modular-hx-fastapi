#!/usr/bin/env python3
"""Retrieve stored process telemetry through Grafana's provisioned data sources."""
import argparse,base64,json,pathlib,time,urllib.parse,urllib.request
p=argparse.ArgumentParser()
p.add_argument("--grafana",required=True);p.add_argument("--evidence",required=True)
p.add_argument("--user",default="n2f");p.add_argument("--password",default="n2f_local")
args=p.parse_args()
evidence=json.loads(pathlib.Path(args.evidence).read_text())
records=evidence.get("delivery_records",evidence["records"]);service=records[0]["service"]["name"];instance=records[0]["service"]["instance_id"]
first_ms=min(r["timestamp_ms"] for r in records);last_ms=max(r["timestamp_ms"] for r in records)
authorization="Basic "+base64.b64encode((args.user+":"+args.password).encode()).decode()
def get(source,path,params=None):
    url=args.grafana+"/api/datasources/proxy/uid/"+source+path
    if params:url+="?"+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={"Authorization":authorization,"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=5) as r:return json.load(r)
def wait(check):
    end=time.monotonic()+45;last=None
    while time.monotonic()<end:
        try:
            value=check()
            if value:return value
        except Exception as error:last=str(error)
        time.sleep(1)
    raise AssertionError("stored telemetry not found: "+str(last))
trace=None;stored={}
for record in records:
    ref=record.get("trace",{})
    if not ref.get("sampled"):continue
    trace_id=ref["trace_id"]
    def containing_span():
        candidate=get("tempo","/api/traces/"+trace_id)
        candidates=[s for batch in candidate["batches"] for scope in batch["scopeSpans"] for s in scope["spans"]]
        return candidate if any(base64.b64decode(s["spanId"]).hex()==ref["span_id"] for s in candidates) else None
    stored[trace_id]=wait(containing_span)
    trace=stored[trace_id]
    spans=[s for batch in trace["batches"] for scope in batch["scopeSpans"] for s in scope["spans"]]
    span=next(s for s in spans if base64.b64decode(s["spanId"]).hex()==ref["span_id"])
    assert span["kind"]=="SPAN_KIND_SERVER"
    fields=record["fields"]
    expected_error=fields["termination"]!="response_completed" or fields.get("status",0)>=500 or fields["outcome"] in ("failed","canceled","timed_out")
    assert (span.get("status",{}).get("code")=="STATUS_CODE_ERROR")==expected_error,(fields,span.get("status"))
    attrs={a["key"]:next(iter(a["value"].values())) for a in span.get("attributes",[])}
    assert attrs["http.request.method"]==fields["method"] and attrs["n2f.outcome"]==fields["outcome"]
    assert attrs.get("http.route")==fields.get("route")
    if "status" in fields:assert int(attrs["http.response.status_code"])==fields["status"]
    else:assert "http.response.status_code" not in attrs
def complete_logs():
    result=get("loki","/loki/api/v1/query_range",{"query":'{service_name="'+service+'"} | service_instance_id="'+instance+'"',"start":str((first_ms-1000)*1_000_000),"end":str((last_ms+1000)*1_000_000),"limit":"1000"})["data"]["result"]
    return result if all(r["scope"]["scope_id"] in json.dumps(result) for r in records) else None
logs=wait(complete_logs)
logtext=json.dumps(logs)
assert "http.request.completed" in logtext
assert all(r["scope"]["scope_id"] in logtext for r in records),"stored logs lost provenance linkage"
assert all(r["trace"]["trace_id"] in logtext for r in records if "trace" in r),"stored logs lost trace linkage"
metrics=wait(lambda:get("prometheus","/api/v1/query",{"query":'http_server_request_duration_seconds_count{job="n2f/'+service+'",service_instance_id="'+instance+'"}' ,"time":str((last_ms+1000)/1000)})["data"]["result"])
assert sum(float(v["value"][1]) for v in metrics)>=len(records)
for series in metrics:
    labels=series["metric"]
    assert not any(key in labels for key in ("trace_id","span_id","correlation_id","request_id","n2f_scope_id","n2f_work_id","n2f_correlation_id","url_path","url_query"))
assert "credential-SENTINEL" not in json.dumps([trace,logs,metrics])
print(json.dumps({"service":service,"instance":instance,"trace_retrieved":trace is not None,"log_streams":len(logs),"metric_series":len(metrics),"result":"passed"}))
