import type {
  HTMLAttributes,
  ReactNode
} from "react";

import "./GlassCard.css";

type GlassCardProps =
  HTMLAttributes<HTMLElement> & {
    children: ReactNode;
    title?: string;
    subtitle?: string;
    accent?: "blue" | "violet" | "cyan" | "green";
  };

export function GlassCard({
  children,
  title,
  subtitle,
  accent = "blue",
  className = "",
  ...cardProps
}: GlassCardProps) {
  return (
    <section
      className={[
        "glass-card",
        `glass-card--${accent}`,
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...cardProps}
    >
      {(title || subtitle) && (
        <header className="glass-card__header">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}

      <div className="glass-card__body">
        {children}
      </div>
    </section>
  );
}