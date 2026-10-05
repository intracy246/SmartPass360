import type {
  ButtonHTMLAttributes,
  ReactNode
} from "react";

import "./GlassButton.css";

type GlassButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "success";

type GlassButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    icon?: ReactNode;
    variant?: GlassButtonVariant;
    fullWidth?: boolean;
  };

export function GlassButton({
  children,
  icon,
  variant = "primary",
  fullWidth = false,
  className = "",
  ...buttonProps
}: GlassButtonProps) {
  return (
    <button
      className={[
        "glass-button",
        `glass-button--${variant}`,
        fullWidth ? "glass-button--full" : "",
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...buttonProps}
    >
      {icon && (
        <span className="glass-button__icon">
          {icon}
        </span>
      )}

      <span>{children}</span>
    </button>
  );
}