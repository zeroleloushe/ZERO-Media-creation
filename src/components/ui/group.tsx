import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function InsetGroup({
  header,
  children,
  className,
}: {
  header?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      {header ? (
        <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-subtle">{header}</h3>
      ) : null}
      <div className="overflow-hidden rounded-xl bg-elevated">{children}</div>
    </section>
  );
}

export function InsetRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 border-b border-line px-3.5 last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm text-fg">{label}</div>
        {hint ? <div className="text-[11px] text-subtle">{hint}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; hint?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex rounded-lg bg-chip p-0.5",
        size === "sm" ? "h-8" : "h-10",
      )}
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "flex flex-1 items-center justify-center rounded-md px-2.5 text-sm font-medium transition-colors duration-150",
              on ? "bg-elevated text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
  onDelete,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-fg" : "bg-chip text-muted hover:text-fg",
      )}
    >
      {children}
      {onDelete ? (
        <span
          role="button"
          tabIndex={0}
          className={cn("ml-0.5 grid size-4 place-items-center rounded-full text-[11px] leading-none", active ? "text-primary-fg/70" : "text-subtle hover:text-danger")}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }
          }}
          aria-label="Удалить"
        >
          ×
        </span>
      ) : null}
    </button>
  );
}
