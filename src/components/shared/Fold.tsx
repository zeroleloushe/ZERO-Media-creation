import { InsetGroup } from "@/components/ui/group";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

export function Fold({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <InsetGroup>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left"
      >
        <span>
          <span className="block text-sm">{title}</span>
          {hint ? <span className="block text-[11px] text-subtle">{hint}</span> : null}
        </span>
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="border-t border-line">{children}</div> : null}
    </InsetGroup>
  );
}
