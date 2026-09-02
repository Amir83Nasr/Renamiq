// ── APP SIDEBAR ──────────────────────────────────────────────

import {
  Download,
  FolderSearch,
  History as HistoryIcon,
  Image,
  PackagePlus,
  Settings as SettingsIcon,
  Trash2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
  | "remove"
  | "posters"
  | "history"
  | "settings";

interface NavGroup {
  labelKey: MessageKey;
  items: { id: PageId; icon: typeof Image; labelKey: MessageKey }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "nav.group.main",
    items: [{ id: "workspace", icon: FolderSearch, labelKey: "nav.workspace" }],
  },
  {
    labelKey: "nav.group.downloads",
    items: [
      { id: "subkade", icon: Download, labelKey: "nav.subkade" },
      { id: "posters", icon: Image, labelKey: "nav.posters" },
    ],
  },
  {
    labelKey: "nav.group.subtitles",
    items: [
      { id: "embed", icon: PackagePlus, labelKey: "nav.embed" },
      { id: "remove", icon: Trash2, labelKey: "nav.remove" },
    ],
  },
  {
    labelKey: "nav.group.system",
    items: [
      { id: "history", icon: HistoryIcon, labelKey: "nav.history" },
      { id: "settings", icon: SettingsIcon, labelKey: "nav.settings" },
    ],
  },
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
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ id, icon: Icon, labelKey }) => (
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
        ))}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
