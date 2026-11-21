#!/bin/bash
# HTTP-запити з України (Globalping) до сервера і для порівняння до інших сайтів
for T in yl-mini-app.vova-younglife.workers.dev workers.dev vovayounglife.github.io www.cloudflare.com; do
  ID=$(curl -s -X POST https://api.globalping.io/v1/measurements -H 'content-type: application/json' \
    --data "{\"type\":\"http\",\"target\":\"$T\",\"limit\":6,\"locations\":[{\"country\":\"UA\"}],\"measurementOptions\":{\"protocol\":\"HTTPS\",\"request\":{\"method\":\"HEAD\"}}}" | jq -r .id)
  sleep 12
  echo "== $T"
  curl -s https://api.globalping.io/v1/measurements/$ID | jq -c '.results[] | {city:.probe.city, asn:.probe.network, st:.result.status, code:.result.statusCode, err:(.result.rawOutput // "" | .[0:90]), t:.result.timings.total}'
done
ID=$(curl -s -X POST https://api.globalping.io/v1/measurements -H 'content-type: application/json' --data '{"type":"dns","target":"yl-mini-app.vova-younglife.workers.dev","limit":6,"locations":[{"country":"UA"}]}' | jq -r .id)
sleep 8; echo "== DNS"
curl -s https://api.globalping.io/v1/measurements/$ID | jq -c '.results[] | {city:.probe.city, asn:.probe.network, ans:[.result.answers[]?.value]}'
