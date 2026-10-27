# SmartPass360 deployment

## API service

The API is an ES module application compiled to `apps/api/dist/server.js`. Build it from the repository root after installing the lockfile dependencies:

```sh
npm ci
npm run build --workspace=@smartpass360/api
```

The API loads `apps/api/.env` in development when launched from the API workspace. On Ubuntu, keep production values in a root-managed environment file such as `/etc/smartpass360/api.env`; systemd values take precedence over any `.env` file. Configure at least `NODE_ENV=production`, `PORT=4000`, `DATABASE_URL`, `AUTH_JWT_SECRET`, `OWNER_USERNAME`, `OWNER_PASSWORD`, and `CORS_ORIGIN`. Use a long random JWT secret, a unique owner password, and the exact browser origins that host the dashboard and kiosk. Do not put credentials in `VITE_*` variables or commit an environment file.

Example systemd unit (`/etc/systemd/system/smartpass360-api.service`):

```ini
[Unit]
Description=SmartPass360 API
After=network.target

[Service]
Type=simple
User=smartpass360
Group=smartpass360
WorkingDirectory=/opt/projects/SmartPass360/apps/api
EnvironmentFile=/etc/smartpass360/api.env
ExecStart=/usr/bin/node /opt/projects/SmartPass360/apps/api/dist/server.js
Restart=on-failure
RestartSec=5
KillSignal=SIGTERM
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

The `smartpass360` account must be able to read the repository and environment file. Keep PostgreSQL on its existing private Docker network; the API should connect using the existing private database address and PostgreSQL must not be published publicly.

## Deploy a change

Run these commands on the Ubuntu host from the repository checkout. Replace `main` if deploying another reviewed branch.

```sh
cd /opt/projects/SmartPass360
git pull --ff-only origin main
npm ci
npm run build --workspace=@smartpass360/api
sudo systemctl daemon-reload
sudo systemctl restart smartpass360-api
sudo systemctl status smartpass360-api --no-pager
curl --fail http://127.0.0.1:4000/api/v1/health
curl --fail http://127.0.0.1:4000/api/v1/ready
```

`/api/v1/health` is a process liveness check. `/api/v1/ready` runs a lightweight PostgreSQL query and returns HTTP 503 when the database is unavailable. Review logs with `sudo journalctl -u smartpass360-api -n 100 --no-pager` if startup fails. The service file is an example for installing on the server; this repository cannot update the host's systemd configuration.

The dashboard and kiosk read `VITE_API_BASE_URL` at build time for production deployments. Set it to the public API base URL (including `/api/v1`) or configure the web host to proxy `/api/v1` to the API. Keep private API credentials only in the API's server-side environment.
