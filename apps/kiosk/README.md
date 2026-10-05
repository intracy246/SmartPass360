# SmartPass360 kiosk

## Local activation transport

Start the API with `npm run dev:api` from the repository root and the kiosk
with `npm run dev --workspace=kiosk`. Open `http://localhost:5174`.
Development requests always use `/api/v1` on that origin; `vite.config.ts`
proxies `/api` to `http://127.0.0.1:4000`. No browser request should target
port 3000 or 4000 directly in development.

`VITE_API_BASE_URL` is a production build override only. An unset or blank value
falls back to `/api/v1`. Copy `.env.example` for the local default. Production
hosting must either forward `/api` to the API or supply its deployed URL when
building. Restart Vite after changing environment files.

The activation failure investigated on 2026-10-05 was caused by the ignored
local `.env` setting `VITE_API_BASE_URL=http://localhost:3000/api/v1`. The running
Vite module contained that value and the target refused connections, while
both the API and Vite proxy health endpoints returned HTTP 200. The local
setting was corrected, and development now ignores stale absolute overrides.

Activation stores `smartpass360.kioskId`, `smartpass360.deviceId`,
`smartpass360.siteId`, `smartpass360.siteName`, and `smartpass360.kioskCode`.
Use the same browser profile and origin on subsequent launches; `localhost`
and `127.0.0.1` have separate browser storage. Config requests send
`x-kiosk-device-id`. An unavailable kiosk or invalid device clears the kiosk
identity and returns to setup, retaining the physical device ID. Temporary
connection failures retain activation and offer a retry.

Real activation persistently binds a kiosk to the browser profile. Verify on
the intended physical kiosk or an explicitly approved verification browser.
Do not delete/reset database records to run verification.

Checks: `npm run typecheck --workspace=@smartpass360/api`,
`npm run build --workspace=kiosk`, and `npm run lint --workspace=kiosk`.
Check both `http://127.0.0.1:4000/api/v1/health` and
`http://localhost:5174/api/v1/health`, then activate with an existing code,
reload, and check the Building Dashboard device and timestamps. Confirm the
header and organization dropdown match the kiosk's building.

## Original template notes

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
