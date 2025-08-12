"use client";

import { ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { getMarketingSiteUrl } from "@/components/constants";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/useSession";
import { getFullName } from "@/lib/auth/authUtils";
import { apiClient } from "@/lib/client";
import { toast } from "sonner";

export function AccountDropdown() {
  const { user } = useSession() ?? {};
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await apiClient.post("/auth/logout");
      toast.success("Signed out successfully");
      router.push("/login");
    } catch (error) {
      toast.error("Error signing out");
      router.push("/login"); // Still redirect even if API fails
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="sidebar"
          size="sm"
          className="flex items-center gap-2 w-full h-10 px-2 rounded-lg transition-colors hover:bg-sidebar-accent/80 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          aria-label="Account menu"
        >
          <Avatar fallback={getFullName(user)} size="sm" />
          <span className="truncate text-sm group-data-[collapsible=icon]:hidden">{user.email}</span>
          <ChevronUp className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-(--radix-popper-anchor-width)">
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            window.open(`${getMarketingSiteUrl()}/docs`, "_blank", "noopener,noreferrer");
          }}
        >
          <span>Documentation</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={handleSignOut}>
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
