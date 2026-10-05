import type { PassStatus } from "../../types/pass";

import "./PassStatusBadge.css";

type PassStatusBadgeProps = {
  status: PassStatus;
};

function formatStatus(status: PassStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => {
      return (
        part.charAt(0).toUpperCase() +
        part.slice(1)
      );
    })
    .join(" ");
}

export function PassStatusBadge({
  status
}: PassStatusBadgeProps) {
  return (
    <span
      className={[
        "pass-status-badge",
        `pass-status-badge--${status.toLowerCase()}`
      ].join(" ")}
    >
      <span className="pass-status-badge__dot" />

      {formatStatus(status)}
    </span>
  );
}