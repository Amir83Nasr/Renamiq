// ── APP SIDEBAR ──────────────────────────────────────────────

import {
  Captions,
  History as HistoryIcon,
  Image,
  PackagePlus,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { type MessageKey, t } from "@/i18n";

type PageId =
  | "workspace"
  | "subkade"
  | "embed"
  | "posters"
  | "history"
  | "settings";

const NAV: { id: PageId; icon: typeof Image; labelKey: MessageKey }[] = [
  { id: "workspace", icon: Image, labelKey: "nav.workspace" },
  { id: "subkade", icon: Captions, labelKey: "nav.subkade" },
  { id: "embed", icon: PackagePlus, labelKey: "nav.embed" },
  { id: "posters", icon: Image, labelKey: "nav.posters" },
  { id: "history", icon: HistoryIcon, labelKey: "nav.history" },
  { id: "settings", icon: SettingsIcon, labelKey: "nav.settings" },
];

export type { PageId };

export function AppSidebar({
  page,
  onNavigate,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  page: PageId;
  onNavigate: (page: PageId) => void;
}) {
  return (
    // ponytail: top-9 clears the macOS traffic-light strip; swap for inset variant if titlebar moves
    <Sidebar
      variant="floating"
      className="top-9 h-[calc(100%-2.25rem)]"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <img
                src="/logo-dark.png"
                alt=""
                aria-hidden
                className="size-8 rounded-lg"
              />
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-semibold">{t("app.title")}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t("app.tagline")}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ id, icon: Icon, labelKey }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={page === id}
                    className="data-active:bg-primary/10 data-active:text-primary data-active:hover:bg-primary/15"
                    onClick={() => onNavigate(id)}
                    aria-current={page === id ? "page" : undefined}
                  >
                    <Icon />
                    <span>{t(labelKey)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
