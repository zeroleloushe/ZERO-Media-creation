import { cn } from "@/lib/utils";
import type { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-line bg-chip px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle focus:border-line-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "h-40 max-h-[70vh] min-h-32 w-full resize-y overflow-y-auto rounded-xl border border-line bg-chip px-3.5 py-3 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle focus:border-line-strong",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-[11px] font-medium uppercase tracking-[0.14em] text-subtle", className)}
      {...props}
    />
  );
}

export function SelectNative({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-line bg-chip px-2 text-sm text-fg outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
