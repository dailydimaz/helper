"use client";

import { ArrowUpDown, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/pageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommonIssuesSettings } from "@/hooks/use-settings";
import { useApi } from "@/hooks/use-api";
import { mutate } from "swr";
import { IssueGroupCard } from "./issueGroupCard";

export default function CommonIssuesPage() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"frequency" | "recent">("frequency");
  const limit = 20;

  // Reset page when search or sort changes
  useEffect(() => {
    setPage(0);
  }, [searchQuery, sortBy]);

  const { commonIssues: data, isLoading, error } = useCommonIssuesSettings();
  const { post, put } = useApi();

  // For now, we'll just use the common issues data
  // In a real implementation, we'd separate pinned vs regular issue groups
  const pinnedData = { groups: [] }; // TODO: Implement pinned groups
  
  const handlePinAction = async (groupId: number, action: 'pin' | 'unpin') => {
    try {
      await post(`/common-issues/${groupId}/${action}`, {});
      toast.success(`Issue group ${action === 'pin' ? 'bookmarked' : 'unbookmarked'}`);
      
      // Refresh the common issues data
      await mutate('/settings/common-issues');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredAndSortedGroups = useMemo(() => {
    if (!data) return [];

    let filtered = data;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (group) => group.title.toLowerCase().includes(query) || group.description?.toLowerCase().includes(query),
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === "frequency") {
        return b.openCount - a.openCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return filtered;
  }, [data, searchQuery, sortBy]);

  const handlePinGroup = (groupId: number) => {
    handlePinAction(groupId, 'pin');
  };

  const handleUnpinGroup = (groupId: number) => {
    handlePinAction(groupId, 'unpin');
  };

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="Common Issues" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h3 className="text-lg font-medium">Error loading issue groups</h3>
            <p className="text-muted-foreground mt-2">{error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Common Issues">
        <Input
          placeholder="Search common issues..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 rounded-full text-sm"
          iconsPrefix={<Search className="ml-1 h-4 w-4 text-foreground" />}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              {sortBy === "frequency" ? "Frequency" : "Recent"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortBy("frequency")}>Sort by Frequency</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy("recent")}>Sort by Recent</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pl-6 space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAndSortedGroups.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">{searchQuery ? "No issues found" : "No issue groups yet"}</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery ? (
                  "Try adjusting your search terms"
                ) : (
                  <Button variant="bright" className="mt-4" asChild>
                    <Link href="/settings/common-issues">
                      <Plus className="h-4 w-4 mr-2" />
                      Create in settings
                    </Link>
                  </Button>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-stretch">
                {filteredAndSortedGroups.map((group) => {
                  const isPinned = pinnedData?.groups.some((p) => p.id === group.id) ?? false;

                  return (
                    <IssueGroupCard
                      key={group.id}
                      group={group}
                      isPinned={isPinned}
                      onPin={handlePinGroup}
                      onUnpin={handleUnpinGroup}
                    />
                  );
                })}
              </div>

              {data?.length === limit * (page + 1) && !searchQuery && (
                <div className="flex justify-center mt-6">
                  <Button onClick={() => setPage(page + 1)} variant="outlined">
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
