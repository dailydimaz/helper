"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  Users,
  MessageSquare,
  MessageCircle,
  FolderOpen,
  Settings,
  LogOut,
  Home,
} from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

const navigation = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        url: "/adm/dashboard",
        icon: Home,
      },
    ],
  },
  {
    title: "Management",
    items: [
      {
        title: "Users",
        url: "/adm/users",
        icon: Users,
      },
      {
        title: "Conversations",
        url: "/adm/conversations",
        icon: MessageSquare,
      },
      {
        title: "Saved Replies",
        url: "/adm/saved-replies",
        icon: MessageCircle,
      },
      {
        title: "Issue Groups",
        url: "/adm/issue-groups",
        icon: FolderOpen,
      },
    ],
  },
  {
    title: "Configuration",
    items: [
      {
        title: "Settings",
        url: "/adm/settings",
        icon: Settings,
      },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const api = useApi();
  const router = useRouter();
  const { user, reload } = useUser();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      await reload();
      router.push("/adm/login");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-4">
          <BarChart3 className="h-6 w-6" />
          <span className="font-semibold text-lg">Admin Dashboard</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="p-2 text-sm text-muted-foreground">
                  Logged in as: {user?.email}
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  );
}