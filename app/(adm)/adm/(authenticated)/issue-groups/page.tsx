"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import DataTable from "@/components/ui/data-table";
import DashboardSearch from "@/components/dashboard-search";
import DashboardPaginate from "@/components/dashboard-paginate";
import { useTable } from "@/hooks/use-table";
import { useApi } from "@/hooks/use-api";
import { useConfirm } from "@/hooks/use-confirm";
import { MoreHorizontal, PlusIcon, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface IssueGroup {
  id: number;
  title: string;
  description: string | null;
  conversationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function IssueGroupsPage() {
  const api = useApi();
  const { data, total, totalLoading, mutate, perPage } = useTable({
    pathname: "/adm/issue-groups",
    perPage: 10,
  });
  const { confirm, ConfirmDialog } = useConfirm();

  const columns: ColumnDef<IssueGroup>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <Link 
          href={`/adm/issue-groups/${row.original.id}`}
          className="text-blue-600 hover:underline font-medium"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate text-sm text-muted-foreground">
          {row.original.description || "No description"}
        </div>
      ),
    },
    {
      accessorKey: "conversationCount",
      header: "Conversations",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.conversationCount || 0}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
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
              <Link href={`/adm/issue-groups/${row.original.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row.original.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Issue Group",
      description: "Are you sure you want to delete this issue group? This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });

    if (confirmed) {
      try {
        await api.delete(`/adm/issue-groups/${id}`);
        toast.success("Issue group deleted successfully");
        mutate();
      } catch (error) {
        toast.error("Failed to delete issue group");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Issue Groups Management</h1>
          <p className="text-muted-foreground">
            Organize and categorize common customer issues
          </p>
        </div>
        <Button asChild>
          <Link href="/adm/issue-groups/create">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Issue Group
          </Link>
        </Button>
      </div>

      <DashboardSearch placeholder="Search issue groups..." />

      <DataTable columns={columns} data={data} />

      <DashboardPaginate total={total} perPage={perPage} loading={totalLoading} />

      <ConfirmDialog />
    </div>
  );
}