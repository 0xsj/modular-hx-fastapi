# Worked provenance scenarios

These fixtures describe required behavior. They are not executable tests.
Symbolic IDs stand for distinct valid shared UUIDs supplied by a sequence generator.
All timestamps below are exact whole-millisecond samples from a controlled clock.

## User request, queued export and another attempt

Alice requests an export for tenant acme. The API executor is service:api. No
external correlation is supplied. Open produces:

| Field | Request scope A |
| --- | --- |
| scope / work / correlation | A / A / A |
| operation / origin | exports.request / request |
| initiator / executor / tenant | user:alice / service:api / acme |
| attempt / depth / cause | 1 / 0 / absent |
| startedAt | 2026-09-11T10:00:00.000Z |

The application prepares work J, operation exports.generate, caused by event E.
The WorkContext retains correlation A, initiator Alice, tenant acme, origin
request and depth 1. It has no scope ID, start time, executor or attempt. Preparing
it does not prove that E or J was stored/published.

Execute J at attempt 1 on service:export-worker opens scope B at
10:00:03.000Z. Retry B on service:export-worker-v2 opens scope C at
10:00:04.000Z. B and C both name work J and cause event E; C has attempt 2 and
previousAttempt B. Correlation and depth remain A and 1. Executors differ while
the initiator remains Alice. The attempt-2 scope is not a child at depth 2.

A concurrent second Retry B may also report attempt 2, with another fresh scope D.
This records two distinct executions and does not assert which one committed.
An execution reconstructed from WorkContext can report owner-supplied attempt 2
without inventing previousAttempt when the previous scope is unknown.

## Replay is a new intervention

An operator Bob replays original work J with replay-run R. The new scope X has
correlation X, work X by default, origin replay, attempt 1, depth 0 and a current
start time. ReplayInfo is {run R, source work:J}. Bob is the new initiator and the
executor is supplied by the current application. Alice and acme are not silently
copied; authorized replay inputs explicitly choose attribution and tenant.

A child Y of X inherits correlation X and ReplayInfo. Its own cause is scope X,
its operation/executor are supplied, and its new work/depth follow Child rules.
ReplayInfo means this lineage exists because J was replayed; Y does not claim to
be a second execution of J. Original event occurrence/recording times remain on
the original records. The replay does not overwrite them with today's startedAt.

## An aggregate has several inputs

Report work M combines events E1, E2 and E3, originally in different correlations.
Its owning envelope carries three input links. The operation explicitly chooses
its primary trigger or opens a new root; LinkSet order makes neither decision.
A missing E2 remains an unresolved reference. No actor or tenant is inferred by
choosing the first available input. A batch larger than the 32-link input bound
uses an owned manifest reference rather than truncating ancestry silently.

## Incoming context has a disposition

| Input | Inspection | Scope opened by Enter |
| --- | --- | --- |
| No hints | fresh | New local correlation, local origin, depth 0 |
| Correlation K and scope cause P, both valid | continued | Correlation K, cause scope:P, source external, origin/depth unknown |
| Correlation K valid, cause malformed | continued + causation/invalid_id | Correlation K, no cause, unknown origin/depth |
| Invalid correlation plus otherwise valid cause P | restarted + correlation/invalid_id + causation/missing_correlation | New local correlation; no adopted cause |
| Only a valid cause P | restarted + causation/missing_correlation | New local correlation; no adopted cause |
| Present empty correlation | restarted + correlation/invalid_id | Different diagnostic from absent correlation |

Local attribution comes from the receiving application's established context,
never from these hints. When an authenticated worker must recover complete
WorkContext, it uses validation and producer policy at that separate boundary;
InspectIncoming cannot launder a partial public header into authenticated work.

## A socket carries many interactions

Connection C1 receives two unrelated messages. They open scopes S1 and S2 with
separate default work/correlation IDs. Transport records carry connection C1 beside
each scope. A request/response pair for one message can share its execution scope;
an unrelated later message starts its own work.

After reconnect, connection C2 replaces C1. If a concrete resumption protocol
identifies the same logical work, Execute can preserve that work/correlation and
open scope S3. The existence of C1 or C2 alone cannot identify a retry or authorize
resumption. These are future WebSocket adapter assertions, not implemented sockets.
