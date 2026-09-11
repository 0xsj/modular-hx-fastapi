#!/usr/bin/env bash
# Probe live components: a startup marker alone stays present after a failure.
set -eu
for endpoint in \
  http://127.0.0.1:3000/api/health \
  http://127.0.0.1:13133/ready \
  http://127.0.0.1:3100/ready \
  http://127.0.0.1:3200/ready \
  http://127.0.0.1:9090/-/ready \
  http://127.0.0.1:4040/ready
do
  curl --fail --silent --show-error --max-time 2 "$endpoint" > /dev/null
done
