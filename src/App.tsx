import {
  Captions,
  Film,
  FolderTree,
  History,
  Settings as SettingsIcon,
} from "lucide-react";
import { useState } from "react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import ActivityPage from "@/pages/ActivityPage";
import LibraryPage from "@/pages/LibraryPage";
import OrganizePage from "@/pages/OrganizePage";
import SettingsPage from "@/pages/SettingsPage";
import SubtitlesPage from "@/pages/SubtitlesPage";

const NAV = [
  { id: "library", icon: Film, label: t("nav.library") },
  { id: "organize", icon: FolderTree, label: t("nav.organize") },
  { id: "subtitles", icon: Captions, label: t("nav.subtitles") },
  { id: "activity", icon: History, label: t("nav.activity") },
  { id: "settings", icon: SettingsIcon, label: t("nav.settings") },
] as const;

type PageId = (typeof NAV)[number]["id"];

export default function App() {
  const [page, setPage] = useState<PageId>("library");

  return (
    <div className="flex h-screen">
      <nav className="flex w-48 shrink-0 flex-col border-r bg-card px-2 py-4">
        <div className="mb-6 flex items-center gap-2 px-3">
          <span className="text-base font-semibold tracking-tight">
            {t("app.title")}
          </span>
        </div>
        <ul className="space-y-1">
          {NAV.map(({ id, icon: Icon, label }) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setPage(id)}
                aria-current={page === id ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  page === id
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-auto px-3 text-[11px] leading-tight text-muted-foreground/60">
          {t("app.tagline")}
        </p>
      </nav>

      <main className="min-w-0 flex-1 overflow-hidden">
        {page === "library" && <LibraryPage />}
        {page === "organize" && <OrganizePage />}
        {page === "subtitles" && <SubtitlesPage />}
        {page === "activity" && <ActivityPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}
