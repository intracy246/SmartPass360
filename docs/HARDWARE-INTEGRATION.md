# SmartPass360 Batch C Hardware Integration Contract

SmartPass360 API is authoritative. Hardware must execute only explicit API commands.

## Common gate device identity
Provision a Gate Access Device in Gate Setup. Store its one-time device key only on the trusted edge controller and send it in the x-gate-device-key header. Never put the key in browser JavaScript, QR codes, snapshots, logs, or tickets. Invalid/disabled devices and unavailable gates fail closed.

## ANPR camera and boom barrier
Topology: ANPR camera -> local edge adapter -> POST /api/v1/vehicle-access/recognize -> relay/controller -> boom barrier.

The camera can deliver plate events through a documented vendor HTTP event/webhook, SDK, ONVIF event, or equivalent. RTSP is video transport and does not by itself define plate metadata.

Recognition body fields: plateNumber, optional direction, confidence, snapshotUrl, and a unique requestId. Actuate only when the API returns action UNLOCK. KEEP_LOCKED, HTTP errors, timeout, invalid JSON, and network failure must keep the barrier locked. Deduplicate eventId/requestId and pulse the relay once.

Unknown vehicles stay locked and enter Security approval. After approval the edge adapter polls GET /api/v1/vehicle-access/gate-command using the same device key. Execute only a non-expired UNLOCK command, then POST /api/v1/vehicle-access/gate-command/:eventId/ack with status ACKNOWLEDGED or FAILED. Keep an idempotency cache of processed event IDs.

Induction loops, photocells, anti-crush sensors, emergency release, and local manual override remain hard-wired safety functions independent of the API.

## QR scanner and pedestrian turnstile
Topology: 2D QR scanner -> trusted local edge adapter -> SmartPass360 access API -> isolated relay/controller -> turnstile.

Visitor QR: POST /api/v1/access/hardware/qr-scan with x-gate-device-key. Send credential, gateId, optional direction, and a unique UUID requestId.

Permanent pass QR: POST /api/v1/access/permanent-pass/scan with x-gate-device-key. Send qrCode, gateId, and a unique UUID requestId. Scanner retries with the same requestId return no new unlock command.

Actuate only for a granted response whose turnstileCommand is UNLOCK. Never unlock on malformed responses, errors, timeouts, or denial. A USB HID scanner may feed the edge app, but a public browser must not directly control a turnstile relay.

## Thermal printer
Visitor tickets are formatted for 80 mm thermal media. Kiosk auto-print is enabled by default. Set VITE_KIOSK_AUTO_PRINT=false only for an intentionally manual-print deployment.

Browser window.print cannot universally bypass the operating-system dialog. For unattended production printing, configure the dedicated kiosk browser/OS in kiosk printing mode with the thermal printer as default, or use an approved local/vendor print bridge. Never expose printer-control services publicly.

## Hardware acceptance
1. Wrong or disabled device key cannot submit ANPR/QR access and gate stays locked.
2. Permanent vehicle ENTRY and EXIT unlock once; duplicate events do not pulse twice.
3. Expected visitor vehicle follows approved visitor/pass state.
4. Unknown vehicle stays locked until a fresh Security approval produces an UNLOCK command.
5. Low-confidence ANPR stays locked for review.
6. Suspended, revoked, expired, or inactive credentials stay locked.
7. Visitor QR ENTRY/EXIT is building/gate scoped and duplicate request IDs do not re-unlock.
8. Permanent QR requires authenticated hardware.
9. API/network outage is fail-secure while physical emergency egress remains locally operable.
10. 80 mm ticket QR is readable across a printed batch.
11. Camera testing covers day/night, glare, rain, headlights, plate angle, and Tanzanian plate formats.
12. Barrier loops/photocells and manual emergency controls work independently.

API simulation is not final hardware acceptance. Final acceptance requires the actual camera, controller/relay, barrier or turnstile, scanner, printer, and customer-site network path.
