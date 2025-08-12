"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DataTable from "@/components/ui/data-table";
import DashboardSearch from "@/components/dashboard-search";
import DashboardPaginate from "@/components/dashboard-paginate";
import { useTable } from "@/hooks/use-table";
import { useApi } from "@/hooks/use-api";
import { useConfirm } from "@/hooks/use-confirm";
import { MoreHorizontal, Eye, MessageSquare, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

interface Conversation {
  id: number;
  slug: string;
  subject: string;
  toEmailAddress: string;
  fromName: string | null;
  status: "open" | "closed" | "spam";
  assignedToId: string | null;
  assignedTo?: {
    displayName: string | null;
    email: string;
  };
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function ConversationsPage() {
  const api = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const { data, total, totalLoading, mutate, perPage } = useTable({
    pathname: "/adm/conversations",
    perPage: 10,
  });
  const { confirm, ConfirmDialog } = useConfirm();

  const handleStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    
    if (status === "all") {
      params.delete("status");
    } else {
      params.set("status", status);
    }

    router.replace(`${pathname}?${params.toString()}`);
  };

  const columns: ColumnDef<Conversation>[] = [
    {
      accessorKey: "subject",
      header: "Subject",
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <Link 
            href={`/adm/conversations/${row.original.id}`}
            className="text-blue-600 hover:underline font-medium"
          >
            {row.original.subject || "No subject"}
          </Link>
        </div>
      ),
    },
    {
      accessorKey: "fromName",
      header: "From",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.fromName || "Unknown"}</div>
          <div className="text-sm text-muted-foreground">{row.original.toEmailAddress}</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const statusColors = {
          open: "default",
          closed: "secondary",
          spam: "destructive",
        } as const;
        
        return (
          <Badge variant={statusColors[row.original.status]}>
            {row.original.status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "assignedTo",
      header: "Assigned To",
      cell: ({ row }) => (
        <span>
          {row.original.assignedTo?.displayName || row.original.assignedTo?.email || "Unassigned"}
        </span>
      ),
    },
    {
      accessorKey: "messageCount",
      header: "Messages",
      cell: ({ row }) => (
        <div className="flex items-center">
          <MessageSquare className="h-4 w-4 mr-1" />
          {row.original.messageCount}
        </div>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Last Updated",
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/adm/conversations/${row.original.id}`}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Link>
            </DropdownMenuItem>
            {row.original.status === "open" && (
              <DropdownMenuItem
                onClick={() => handleStatusChange(row.original.id, "closed")}
              >
                <UserCheck className="h-4 w-4 mr-2" />
                Close
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => handleStatusChange(row.original.id, "spam")}
              className="text-destructive"
            >
              <X className="h-4 w-4 mr-2" />
              Mark as Spam
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleStatusChange = async (conversationId: number, newStatus: string) => {
    const confirmed = await confirm({
      title: `Change Status to ${newStatus}`,
      description: `Are you sure you want to change this conversation's status to ${newStatus}?`,
      confirmText: "Change Status",
    });

    if (confirmed) {
      try {
        await api.put(`/adm/conversations/${conversationId}`, { status: newStatus });
        toast.success("Conversation status updated");
        mutate();
      } catch (error) {
        toast.error("Failed to update conversation status");
      }
    }
  };

  const currentStatus = searchParams.get("status") || "all";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conversations Management</h1>
      </div>

      <div className="flex items-center gap-4">
        <DashboardSearch placeholder="Search conversations..." />
        <Select value={currentStatus} onValueChange={handleStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="spam">Spam</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data} />

      <DashboardPaginate total={total} perPage={perPage} loading={totalLoading} />

      <ConfirmDialog />
    </div>
  );
}