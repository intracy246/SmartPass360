import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ApiError } from "../../api/api-client";
import {
  getBuildings,
  updateBuildingSettings
} from "../../api/building-api";

import "./SettingsPage.css";

async function compressLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Logo must be smaller than 5 MB.");
  }

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read logo."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not process logo."));
    img.src = source;
  });

  const max = 512;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process logo.");

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", 0.86);
}

export function SettingsPage() {
  const buildingsQuery = useQuery({
    queryKey: ["building-settings"],
    queryFn: getBuildings
  });

  const buildings = buildingsQuery.data?.data ?? [];
  const [selectedId, setSelectedId] = useState("");
  const selected = useMemo(
    () => buildings.find((building) => building.id === selectedId) ?? buildings[0],
    [buildings, selectedId]
  );

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setName(selected.name);
    setLogoUrl(selected.logoUrl ?? null);
    setMessage(null);
  }, [selected?.id]);

  const mutation = useMutation({
    mutationFn: () =>
      updateBuildingSettings(selected!.id, {
        name: name.trim(),
        logoUrl
      }),
    onSuccess: async () => {
      setMessage("Building settings saved. Registered kiosks will receive this branding.");
      await buildingsQuery.refetch();
    },
    onError: (error) => {
      setMessage(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Could not save building settings."
      );
    }
  });

  async function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setMessage("Preparing logo...");
      setLogoUrl(await compressLogo(file));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not process logo.");
    } finally {
      event.target.value = "";
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !name.trim()) return;
    mutation.mutate();
  }

  return (
    <main className="building-settings">
      <header>
        <p>SMARTPASS360 SETTINGS</p>
        <h1>Building Identity</h1>
        <span>
          Set the building name and logo shown on kiosks registered to this building.
        </span>
      </header>

      {buildingsQuery.isPending && <div className="building-settings__empty">Loading buildings...</div>}
      {buildingsQuery.isError && <div className="building-settings__empty">Building service is unavailable.</div>}
      {!buildingsQuery.isPending && !buildingsQuery.isError && buildings.length === 0 && (
        <div className="building-settings__empty">No building has been registered yet.</div>
      )}

      {selected && (
        <form onSubmit={submit} className="building-settings__card">
          <label>
            <span>Building</span>
            <select value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Building name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>

          <div className="building-settings__logo">
            <div className="building-settings__preview">
              {logoUrl ? <img src={logoUrl} alt={name || "Building logo"} /> : <strong>NO LOGO</strong>}
            </div>
            <div>
              <strong>Building logo</strong>
              <p>PNG, JPG or WebP. The image is optimized before saving.</p>
              <label className="building-settings__upload">
                Upload logo
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogo} />
              </label>
              {logoUrl && (
                <button type="button" className="building-settings__remove" onClick={() => setLogoUrl(null)}>
                  Remove logo
                </button>
              )}
            </div>
          </div>

          {message && <div className="building-settings__message">{message}</div>}

          <button className="building-settings__save" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving..." : "Save Building Settings"}
          </button>
        </form>
      )}
    </main>
  );
}
