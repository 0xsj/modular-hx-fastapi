# Native socket cleanup

ws emits message events without awaiting an async listener. A pending Promise therefore acts as admission state: a second application message closes 1013 instead of creating an unbounded Promise queue. AbortController communicates cancellation; the active entry remains owned until pending work actually finishes. Failed session construction terminates the socket immediately, and cleanup exceptions cannot become unhandled rejections.

Root stops new HTTP admission while draining sockets under the same remaining
shutdown budget. A graceful 1001 close is attempted before forced transport close.
The root diagnostic's handler never retains a socket handle. A future domain
subscription must own its cleanup explicitly rather than capture a connection in
an unbounded background task.
