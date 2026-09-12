# Root owns the first HTTP consumer

The specification-stage plan is now implemented. Read
[HTTP verification](http-verification.md) for current evidence and
[the run guide](../../../../TELEMETRY_HTTP.md)
for settings and commands.

Root validates configuration before startup, constructs one service instance for
logging and SDK resources, supplies explicit provenance admission, and chooses the
native observer. It stops admission and drains requests before telemetry/logging
shutdown. Transport termination is never interpreted as transaction rollback.
