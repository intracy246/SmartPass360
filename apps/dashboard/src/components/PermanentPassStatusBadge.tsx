import type {
  PermanentPassStatus
} from "../types/permanent-pass";

type PermanentPassStatusBadgeProps = {
  status: PermanentPassStatus;
};

const labels: Record<
  PermanentPassStatus,
  string
> = {
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  EXPIRED: "Expired",
  REVOKED: "Revoked"
};

export function PermanentPassStatusBadge({
  status
}: PermanentPassStatusBadgeProps) {
  return (
    <span
      className={`permanent-pass-status permanent-pass-status--${status.toLowerCase()}`}
    >
      {labels[status]}
    </span>
  );
}