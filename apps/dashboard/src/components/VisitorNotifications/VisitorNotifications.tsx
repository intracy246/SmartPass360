import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getVisitorOperations } from "../../api/visitor-api";
import "./VisitorNotifications.css";

type AlertSettingsEvent = CustomEvent<{ enabled: boolean }>;

export function VisitorNotifications() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notice, setNotice] = useState<{ id: string; count: number; names: string[]; sources: string[] } | null>(null);
  const previousPendingIds = useRef<Set<string> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const operations = useQuery({
    queryKey: ["visitor-operations"],
    queryFn: getVisitorOperations,
    refetchInterval: 2500,
    refetchIntervalInBackground: true
  });

  useEffect(() => {
    const updateSettings = (event: Event) => {
      const settings = (event as AlertSettingsEvent).detail;
      const enabled = Boolean(settings?.enabled);
      setSoundEnabled(enabled);
      if (enabled) {
        try {
          const context = audioContextRef.current ?? new AudioContext();
          audioContextRef.current = context;
          void context.resume();
        } catch (error) {
          console.warn("SmartPass360 audio notification could not be enabled.", error);
        }
      }
    };
    window.addEventListener("smartpass360:visitor-alert-settings", updateSettings);
    return () => window.removeEventListener("smartpass360:visitor-alert-settings", updateSettings);
  }, []);

  useEffect(() => {
    const pending = operations.data?.data.pending ?? [];
    if (operations.isPending || operations.isError) return;

    const currentIds = new Set(pending.map((visit) => visit.id));
    const previousIds = previousPendingIds.current;
    // A first load establishes the baseline. It does not announce old pending visits.
    if (previousIds) {
      const arrivals = pending.filter((visit) => !previousIds.has(visit.id));
      if (arrivals.length > 0) {
        const nextNotice = {
          id: arrivals.map((visit) => visit.id).join(":"),
          count: arrivals.length,
          names: arrivals.slice(0, 4).map((visit) => visit.fullName),
          sources: [...new Set(arrivals.map((visit) => visit.source))]
        };
        setNotice(nextNotice);

        if (soundEnabled) {
          try {
            const context = audioContextRef.current ?? new AudioContext();
            audioContextRef.current = context;
            const playChime = () => {
              const startAt = context.currentTime;
              [0, 0.26, 0.52].forEach((offset, index) => {
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = "sine";
                oscillator.frequency.value = index === 1 ? 1046 : 880;
                gain.gain.setValueAtTime(0.0001, startAt + offset);
                gain.gain.exponentialRampToValueAtTime(0.18, startAt + offset + 0.025);
                gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.2);
                oscillator.connect(gain);
                gain.connect(context.destination);
                oscillator.start(startAt + offset);
                oscillator.stop(startAt + offset + 0.22);
              });
            };
            if (context.state === "suspended") {
              void context.resume().then(playChime).catch((error) => {
                console.warn("SmartPass360 visitor alert sound could not resume.", error);
              });
            } else {
              playChime();
            }
          } catch (error) {
            console.warn("SmartPass360 visitor alert sound could not play.", error);
          }
        }

        if ("Notification" in window && Notification.permission === "granted") {
          try {
            new Notification("SmartPass360 · Approval required", {
              body: arrivals.length === 1
                ? `${arrivals[0].fullName} is waiting for approval.`
                : `${arrivals.length} visitors are waiting for approval.`,
              icon: "/favicon.svg",
              tag: "smartpass360-pending-visitors"
            });
          } catch (error) {
            console.warn("SmartPass360 browser notification could not be displayed.", error);
          }
        }
      }
    }

    previousPendingIds.current = currentIds;
  }, [operations.data?.data.pending, operations.isPending, operations.isError, soundEnabled]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 12_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  if (!notice) return null;

  return (
    <aside className="visitor-alert-toast" role="status" aria-live="assertive">
      <div className="visitor-alert-toast__icon" aria-hidden="true">🔔</div>
      <div className="visitor-alert-toast__body">
        <strong>Visitor waiting for approval</strong>
        <span>
          {notice.count === 1 ? "1 new registration" : `${notice.count} new registrations`}
          {notice.names.length ? ` · ${notice.names.join(", ")}` : ""}
        </span>
        {notice.sources.length > 0 ? <small>Source: {notice.sources.join(", ")}</small> : null}
      </div>
      <a href="/operations" className="visitor-alert-toast__review">Review</a>
      <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification">×</button>
    </aside>
  );
}
