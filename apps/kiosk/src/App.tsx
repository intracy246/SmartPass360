import { useMemo, useState } from "react";
import { activateKiosk } from "./api/kiosk-api";
import { ApiError } from "./api/api-client";
import { KioskRegistrationPage } from "./pages/KioskRegistrationPage";
import "./pages/KioskActivationPage.css";

function getDeviceId() {
  const existing = window.localStorage.getItem("smartpass360.deviceId");
  if (existing) return existing;

  const value = window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem("smartpass360.deviceId", value);
  return value;
}

export default function App() {
  const initialKioskId = window.localStorage.getItem("smartpass360.kioskId");
  const [activatedKioskId, setActivatedKioskId] = useState(initialKioskId);
  const [activationCode, setActivationCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const deviceId = useMemo(() => getDeviceId(), []);

  if (activatedKioskId) {
    return <KioskRegistrationPage />;
  }

  async function submitActivation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsActivating(true);

    try {
      const response = await activateKiosk({
        activationCode: activationCode.trim().toUpperCase(),
        deviceId
      });

      window.localStorage.setItem("smartpass360.kioskId", response.data.kiosk.id);
      window.localStorage.setItem("smartpass360.siteId", response.data.site.id);
      window.localStorage.setItem("smartpass360.siteName", response.data.site.name);
      window.localStorage.setItem("smartpass360.kioskCode", response.data.kiosk.code);

      setActivatedKioskId(response.data.kiosk.id);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else if (error instanceof TypeError) {
        setErrorMessage("Cannot reach SmartPass360 API. Confirm the API is running on port 4000, then restart this kiosk app.");
      } else {
        setErrorMessage(error instanceof Error ? error.message : "Kiosk activation failed.");
      }
    } finally {
      setIsActivating(false);
    }
  }

  return (
    <main className="activation-screen">
      <section className="activation-card">
        <div className="activation-brand">
          <div className="activation-brand__mark">SP</div>
          <div>
            <strong>SMARTPASS360</strong>
            <span>Kiosk Activation</span>
          </div>
        </div>

        <div className="activation-copy">
          <p>SECURE DEVICE SETUP</p>
          <h1>Activate this kiosk</h1>
          <span>Enter the activation code issued from this building's SmartPass360 dashboard.</span>
        </div>

        <form onSubmit={submitActivation}>
          <label>
            <span>Activation code</span>
            <input
              value={activationCode}
              onChange={(event) => setActivationCode(event.target.value)}
              placeholder="Enter activation code"
              autoComplete="off"
              autoCapitalize="characters"
              required
            />
          </label>

          {errorMessage && <div className="activation-error">{errorMessage}</div>}

          <button disabled={isActivating || activationCode.trim().length < 6}>
            {isActivating ? "Activating..." : "Activate Kiosk"}
          </button>
        </form>

        <div className="activation-device">
          <span>Device ID</span>
          <strong>{deviceId}</strong>
        </div>
      </section>
    </main>
  );
}
