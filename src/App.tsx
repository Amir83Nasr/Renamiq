// ── APP MAIN COMPONENT ───────────────────────────────────────

import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppSidebar, type PageId } from "@/components/app-sidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TitleBar } from "@/components/ui/titlebar";
import { t } from "@/i18n";
import EmbedPage from "@/pages/EmbedPage";
import PostersPage from "@/pages/PostersPage";
import SettingsPage from "@/pages/SettingsPage";
import SubkadePage from "@/pages/SubkadePage";
import WorkspacePage from "@/pages/WorkspacePage";
import { useWorkspace } from "@/stores/workspace";

// ── SIDEBAR RESIZE ───────────────────────────────────────────

const MIN_SIDEBAR_WIDTH = 208;
const MAX_SIDEBAR_WIDTH = 440;
const DEFAULT_SIDEBAR_WIDTH = 256;

const clampWidth = (w: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, w));

// ── APP ──────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<PageId>("workspace");
  const loadSettings = useWorkspace((s) => s.loadSettings);
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem("sidebar-width"));
    return Number.isFinite(saved) && saved > 0
      ? clampWidth(saved)
      : DEFAULT_SIDEBAR_WIDTH;
  });
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ startX: 0, startWidth: 0 });

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width };
    setDragging(true);
  };
  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setWidth(
      clampWidth(drag.current.startWidth + e.clientX - drag.current.startX),
    );
  };
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    // Recompute from event: `width` may be one render behind the last move.
    localStorage.setItem(
      "sidebar-width",
      String(
        clampWidth(drag.current.startWidth + e.clientX - drag.current.startX),
      ),
    );
  };

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${width}px` } as React.CSSProperties}
      className={dragging ? "**:transition-none!" : undefined}
    >
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <TitleBar />
        <div className="flex min-h-0 flex-1">
          <AppSidebar page={page} onNavigate={setPage} />
          {/* ponytail: mouse-only resize handle; add keyboard arrow support if ever needed */}
          <ResizeHandle
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onDoubleClick={() => setWidth(DEFAULT_SIDEBAR_WIDTH)}
          />
          <main className="min-w-0 flex-1 overflow-hidden">
            {page === "workspace" && <WorkspacePage />}
            {page === "subkade" && <SubkadePage />}
            {page === "embed" && <EmbedPage />}
            {page === "posters" && <PostersPage />}
            {page === "settings" && <SettingsPage />}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

// ── RESIZE HANDLE ────────────────────────────────────────────

function ResizeHandle(props: React.ComponentProps<"hr">) {
  const { isMobile, state } = useSidebar();
  if (isMobile || state === "collapsed") return null;
  return (
    <hr
      aria-orientation="vertical"
      aria-label={t("sidebar.resize")}
      title={t("sidebar.resize")}
      {...props}
      className="z-10 m-0 h-auto w-1 shrink-0 cursor-col-resize rounded-full border-none hover:bg-sidebar-border active:bg-sidebar-border"
    />
  );
}
