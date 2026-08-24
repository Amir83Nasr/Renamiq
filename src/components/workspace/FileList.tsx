// ── FILE LIST + STATUS ───────────────────────────────────────

import {
  AlertTriangle,
  Ban,
  CircleCheck,
  CircleHelp,
  Film,
  Tv,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type MessageKey, t } from "@/i18n";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/stores/workspace";
import type { ItemStatus, PlanItem } from "@/types/media";

const STATUS_BADGE: Record<
  ItemStatus,
  {
    variant: "success" | "warning" | "destructive" | "secondary";
    key: MessageKey;
  }
> = {
  ready: { variant: "success", key: "status.ready" },
  needsreview: { variant: "warning", key: "status.needsreview" },
  conflict: { variant: "destructive", key: "status.conflict" },
  error: { variant: "destructive", key: "status.error" },
};

const STATUS_ICON: Record<ItemStatus, typeof CircleCheck> = {
  ready: CircleCheck,
  needsreview: CircleHelp,
  conflict: AlertTriangle,
  error: Ban,
};

export function FileList() {
  const { plan, selected, setSelected } = useWorkspace();
  const items = plan?.items ?? [];

  return (
    <ScrollArea className="min-h-0 flex-1 rounded-xl border bg-card">
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <FileRow
            key={item.path}
            item={item}
            active={selected === item.path}
            onClick={() =>
              setSelected(selected === item.path ? null : item.path)
            }
          />
        ))}
      </ul>
    </ScrollArea>
  );
}

function FileRow({
  item,
  active,
  onClick,
}: {
  item: PlanItem;
  active: boolean;
  onClick: () => void;
}) {
  const badge = STATUS_BADGE[item.status];
  const StatusIcon = STATUS_ICON[item.status];
  const changed =
    item.newName !== item.originalName ||
    !item.destination.startsWith(
      item.path.slice(0, item.path.lastIndexOf("/")),
    );

  return (
    <li className="border-none">
      <button
        type="button"
        className={cn(
          "block w-full cursor-pointer px-4 py-3 text-start transition-colors",
          active ? "bg-accent" : "hover:bg-accent/50",
        )}
        onClick={onClick}
        aria-pressed={active}
      >
        <div className="flex items-start gap-3">
          <KindIcon item={item} />
          <div className="min-w-0 flex-1 space-y-1">
            {/* OLD name: de-emphasized */}
            <p className="truncate text-xs text-muted-foreground line-through decoration-border/70">
              <span dir="ltr">{item.originalName}</span>
            </p>
            {/* NEW name: visually dominant */}
            {changed && (
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <span dir="ltr">{item.newName}</span>
              </p>
            )}
            {!changed && (
              <p className="text-sm font-semibold text-muted-foreground">
                <span dir="ltr">{item.originalName}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={badge.variant}>
                <StatusIcon className="size-3" />
                {t(badge.key)}
              </Badge>
              {item.warnings
                .filter((w) => w !== "replace")
                .map((w) => (
                  <span key={w} className="text-xs text-muted-foreground">
                    {t(`warn.${w}` as MessageKey)}
                  </span>
                ))}
              <span
                dir="ltr"
                className="ms-auto truncate text-xs text-muted-foreground/70"
              >
                {item.directory.replace(/^.*[\\/](Movies|TV Shows)/, "$1")}
              </span>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

function KindIcon({ item }: { item: PlanItem }) {
  const Icon = item.kind === "tv" ? Tv : Film;
  return (
    <Icon
      className={cn(
        "mt-0.5 size-4 shrink-0",
        item.kind === "tv" ? "text-primary" : "text-muted-foreground",
      )}
    />
  );
}
