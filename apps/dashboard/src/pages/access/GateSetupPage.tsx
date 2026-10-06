import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createGate,
  createGateDevice,
  getGateDevices,
  getGateSetups,
  rotateGateDeviceKey,
  setGateDeviceActive,
  updateGate
} from "../../api/access-api";
import { getOrganizations } from "../../api/organization-api";
import { GlassButton } from "../../components/Buttons/GlassButton";
import { GlassCard } from "../../components/Cards/GlassCard";

import "./GateSetupPage.css";

type RevealedKey = {
  deviceName: string;
  deviceKey: string;
} | null;

export function GateSetupPage() {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState("");
  const [gateCode, setGateCode] = useState("");
  const [gateName, setGateName] = useState("");
  const [location, setLocation] = useState("");
  const [direction, setDirection] = useState<"ENTRY" | "EXIT" | "BIDIRECTIONAL">("BIDIRECTIONAL");
  const [deviceGateId, setDeviceGateId] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [revealedKey, setRevealedKey] = useState<RevealedKey>(null);

  const organizationsQuery = useQuery({
    queryKey: ["organizations", "gate-setup"],
    queryFn: () => getOrganizations("", 1, 100, true)
  });
  const gatesQuery = useQuery({ queryKey: ["gate-setups"], queryFn: getGateSetups });
  const devicesQuery = useQuery({ queryKey: ["gate-devices"], queryFn: getGateDevices });

  const organizations = organizationsQuery.data?.data ?? [];
  const gates = gatesQuery.data?.data ?? [];
  const devices = devicesQuery.data?.data ?? [];

  const gateById = useMemo(
    () => new Map(gates.map(gate => [gate.id, gate])),
    [gates]
  );

  const createGateMutation = useMutation({
    mutationFn: createGate,
    onSuccess: async () => {
      setGateCode("");
      setGateName("");
      setLocation("");
      await queryClient.invalidateQueries({ queryKey: ["gate-setups"] });
    }
  });

  const createDeviceMutation = useMutation({
    mutationFn: ({ gateId, name }: { gateId: string; name: string }) =>
      createGateDevice(gateId, name),
    onSuccess: async result => {
      setDeviceName("");
      setRevealedKey({
        deviceName: result.data.name,
        deviceKey: result.data.deviceKey
      });
      await queryClient.invalidateQueries({ queryKey: ["gate-devices"] });
    }
  });

  const gateMutation = useMutation({
    mutationFn: ({ gateId, isActive }: { gateId: string; isActive: boolean }) =>
      updateGate(gateId, { isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gate-setups"] });
    }
  });

  const deviceMutation = useMutation({
    mutationFn: ({ deviceId, isActive }: { deviceId: string; isActive: boolean }) =>
      setGateDeviceActive(deviceId, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["gate-devices"] });
    }
  });

  const rotateMutation = useMutation({
    mutationFn: rotateGateDeviceKey,
    onSuccess: result => {
      setRevealedKey({
        deviceName: result.data.name,
        deviceKey: result.data.deviceKey
      });
    }
  });

  return (
    <div className="gate-setup-page">
      <header className="gate-setup-page__header">
        <div>
          <p>Access Infrastructure</p>
          <h1>Gate & ANPR Setup</h1>
          <span>
            Register physical gates and provision trusted ANPR/controller devices.
            Device keys are shown only when created or rotated.
          </span>
        </div>
      </header>

      {revealedKey && (
        <div className="gate-key-banner">
          <div>
            <strong>Save this device key now — {revealedKey.deviceName}</strong>
            <span>The raw key is not stored and cannot be displayed again.</span>
          </div>
          <code>{revealedKey.deviceKey}</code>
          <div className="gate-key-banner__actions">
            <GlassButton
              type="button"
              onClick={() => void navigator.clipboard?.writeText(revealedKey.deviceKey)}
            >
              Copy Key
            </GlassButton>
            <GlassButton type="button" variant="secondary" onClick={() => setRevealedKey(null)}>
              I Saved It
            </GlassButton>
          </div>
        </div>
      )}

      <div className="gate-setup-page__forms">
        <GlassCard title="Register gate" subtitle="Create a real access point for this building." accent="blue">
          <form
            className="gate-setup-form"
            onSubmit={event => {
              event.preventDefault();
              if (!organizationId || !gateCode.trim() || !gateName.trim()) return;
              createGateMutation.mutate({
                organizationId,
                code: gateCode.trim(),
                name: gateName.trim(),
                location: location.trim() || undefined,
                direction
              });
            }}
          >
            <label>
              <span>Organization</span>
              <select value={organizationId} onChange={event => setOrganizationId(event.target.value)} required>
                <option value="">Select organization</option>
                {organizations.map((organization: any) => (
                  <option key={organization.id} value={organization.id}>{organization.name}</option>
                ))}
              </select>
            </label>
            <div className="gate-setup-form__row">
              <label>
                <span>Gate Code</span>
                <input value={gateCode} onChange={event => setGateCode(event.target.value.toUpperCase())} placeholder="MAIN-ENTRY" required />
              </label>
              <label>
                <span>Gate Name</span>
                <input value={gateName} onChange={event => setGateName(event.target.value)} placeholder="Main Vehicle Gate" required />
              </label>
            </div>
            <label>
              <span>Location</span>
              <input value={location} onChange={event => setLocation(event.target.value)} placeholder="Front entrance" />
            </label>
            <label>
              <span>Direction</span>
              <select value={direction} onChange={event => setDirection(event.target.value as typeof direction)}>
                <option value="BIDIRECTIONAL">Bidirectional</option>
                <option value="ENTRY">Entry only</option>
                <option value="EXIT">Exit only</option>
              </select>
            </label>
            <GlassButton type="submit" disabled={createGateMutation.isPending}>
              {createGateMutation.isPending ? "Registering..." : "Register Gate"}
            </GlassButton>
          </form>
        </GlassCard>

        <GlassCard title="Provision ANPR device" subtitle="Bind a camera/controller integration to a registered gate." accent="violet">
          <form
            className="gate-setup-form"
            onSubmit={event => {
              event.preventDefault();
              if (!deviceGateId || !deviceName.trim()) return;
              createDeviceMutation.mutate({ gateId: deviceGateId, name: deviceName.trim() });
            }}
          >
            <label>
              <span>Gate</span>
              <select value={deviceGateId} onChange={event => setDeviceGateId(event.target.value)} required>
                <option value="">Select gate</option>
                {gates.filter(gate => gate.isActive).map(gate => (
                  <option key={gate.id} value={gate.id}>{gate.name} · {gate.code}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Device Name</span>
              <input value={deviceName} onChange={event => setDeviceName(event.target.value)} placeholder="Main Gate ANPR Camera" required />
            </label>
            <p className="gate-setup-form__hint">
              SmartPass360 generates a secret device key. Configure that key on the ANPR integration as the x-gate-device-key header.
            </p>
            <GlassButton type="submit" disabled={createDeviceMutation.isPending}>
              {createDeviceMutation.isPending ? "Provisioning..." : "Provision Device"}
            </GlassButton>
          </form>
        </GlassCard>
      </div>

      <GlassCard title="Registered gates" subtitle="Live access points scoped to this building." accent="blue">
        {gatesQuery.isPending ? (
          <div className="gate-setup-state">Loading gates...</div>
        ) : gates.length === 0 ? (
          <div className="gate-setup-state">No gates have been registered.</div>
        ) : (
          <div className="gate-setup-table-wrap">
            <table className="gate-setup-table">
              <thead><tr><th>Gate</th><th>Organization</th><th>Location</th><th>Direction</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {gates.map(gate => (
                  <tr key={gate.id}>
                    <td><strong>{gate.name}</strong><small>{gate.code}</small></td>
                    <td>{gate.organization?.name ?? "—"}</td>
                    <td>{gate.location ?? "—"}</td>
                    <td>{gate.direction}</td>
                    <td>{gate.isActive ? gate.status : "DISABLED"}</td>
                    <td>
                      <GlassButton
                        type="button"
                        variant="secondary"
                        disabled={gateMutation.isPending}
                        onClick={() => gateMutation.mutate({ gateId: gate.id, isActive: !gate.isActive })}
                      >
                        {gate.isActive ? "Disable" : "Enable"}
                      </GlassButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Trusted gate devices" subtitle="Only active devices with the current secret key can submit ANPR recognition events." accent="violet">
        {devicesQuery.isPending ? (
          <div className="gate-setup-state">Loading devices...</div>
        ) : devices.length === 0 ? (
          <div className="gate-setup-state">No ANPR/controller devices have been provisioned.</div>
        ) : (
          <div className="gate-setup-table-wrap">
            <table className="gate-setup-table">
              <thead><tr><th>Device</th><th>Gate</th><th>Direction</th><th>Last Seen</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {devices.map(device => (
                  <tr key={device.id}>
                    <td><strong>{device.name}</strong></td>
                    <td>{gateById.get(device.gate.id)?.name ?? device.gate.name}</td>
                    <td>{device.gate.direction}</td>
                    <td>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never connected"}</td>
                    <td>{device.isActive ? "ACTIVE" : "DISABLED"}</td>
                    <td>
                      <div className="gate-setup-actions">
                        <GlassButton
                          type="button"
                          variant="secondary"
                          disabled={deviceMutation.isPending}
                          onClick={() => deviceMutation.mutate({ deviceId: device.id, isActive: !device.isActive })}
                        >
                          {device.isActive ? "Disable" : "Enable"}
                        </GlassButton>
                        <GlassButton
                          type="button"
                          variant="secondary"
                          disabled={rotateMutation.isPending}
                          onClick={() => rotateMutation.mutate(device.id)}
                        >
                          Rotate Key
                        </GlassButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
