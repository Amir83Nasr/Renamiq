// ── APP MAIN COMPONENT ───────────────────────────────────────

import { Activity, Film, Settings as SettingsIcon } from "lucide-react";
import { useState } from "react";
import { TitleBar } from "@/components/ui/titlebar";
import { type MessageKey, t } from "@/i18n";
import { cn } from "@/lib/utils";
import ActivityPage from "@/pages/ActivityPage";
import SettingsPage from "@/pages/SettingsPage";
import WorkspacePage from "@/pages/WorkspacePage";

type PageId = "workspace" | "activity" | "settings";

const NAV: { id: PageId; icon: typeof Film; labelKey: MessageKey }[] = [
  { id: "workspace", icon: Film, labelKey: "nav.workspace" },
  { id: "activity", icon: Activity, labelKey: "nav.activity" },
  { id: "settings", icon: SettingsIcon, labelKey: "nav.settings" },
];

export default function App() {
  const [page, setPage] = useState<PageId>("workspace");

  return (
    <div className="flex h-screen flex-col overflow-hidden rounded-4xl bg-background">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-row-reverse">
        {/* Sidebar sits on the RIGHT in RTL; flex-row-reverse + dir=rtl keeps
            it at the visual start edge. */}
        <nav className="flex w-48 shrink-0 select-none flex-col border-s border-border/40 bg-background/40 px-2.5 py-3 backdrop-blur-2xl">
          <div className="mb-3 flex items-center gap-2 px-2 pt-1">
            <span className="text-sm font-bold">{t("app.title")}</span>
          </div>

          <ul className="flex-1 space-y-0.5">
            {NAV.map(({ id, icon: Icon, labelKey }) => {
              const active = page === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setPage(id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-accent font-semibold text-accent-foreground shadow-2xs"
                        : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                    <span>{t(labelKey)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto border-t border-border/40 px-2 pt-2.5">
            <p className="text-[10px] leading-tight text-muted-foreground/60">
              {t("app.tagline")}
            </p>
          </div>
        </nav>

        <main className="min-w-0 flex-1 overflow-hidden bg-background">
          {page === "workspace" && <WorkspacePage />}
          {page === "activity" && <ActivityPage />}
          {page === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}
