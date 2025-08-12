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
import { MoreHorizontal, PlusIcon, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SavedReply {
  id: number;
  slug: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function SavedRepliesPage() {
  const api = useApi();
  const { data, total, totalLoading, mutate, perPage } = useTable({
    pathname: "/adm/saved-replies",
    perPage: 10,
  });
  const { confirm, ConfirmDialog } = useConfirm();

  const columns: ColumnDef<SavedReply>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link 
          href={`/adm/saved-replies/${row.original.id}`}
          className="text-blue-600 hover:underline font-medium"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "content",
      header: "Content Preview",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate text-sm text-muted-foreground">
          {row.original.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
        </div>
      ),
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "default" : "outline"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
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
              <Link href={`/adm/saved-replies/${row.original.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleToggleActive(row.original.id, row.original.isActive)}
            >
              {row.original.isActive ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
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

  const handleToggleActive = async (id: number, isCurrentlyActive: boolean) => {
    try {
      await api.put(`/adm/saved-replies/${id}`, { isActive: !isCurrentlyActive });
      toast.success(`Saved reply ${isCurrentlyActive ? 'deactivated' : 'activated'} successfully`);
      mutate();
    } catch (error) {
      toast.error("Failed to update saved reply status");
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: "Delete Saved Reply",
      description: "Are you sure you want to delete this saved reply? This action cannot be undone.",
      confirmText: "Delete",
      variant: "destructive",
    });

    if (confirmed) {
      try {
        await api.delete(`/adm/saved-replies/${id}`);
        toast.success("Saved reply deleted successfully");
        mutate();
      } catch (error) {
        toast.error("Failed to delete saved reply");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Saved Replies Management</h1>
        <Button asChild>
          <Link href="/adm/saved-replies/create">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Saved Reply
          </Link>
        </Button>
      </div>

      <DashboardSearch placeholder="Search saved replies..." />

      <DataTable columns={columns} data={data} />

      <DashboardPaginate total={total} perPage={perPage} loading={totalLoading} />

      <ConfirmDialog />
    </div>
  );
}