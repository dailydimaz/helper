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
import { MoreHorizontal, PlusIcon, Edit, UserX } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
  id: string;
  email: string;
  displayName: string | null;
  permissions: string;
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const api = useApi();
  const { data, total, totalLoading, mutate, perPage } = useTable({
    pathname: "/adm/users",
    perPage: 10,
  });
  const { confirm, ConfirmDialog } = useConfirm();

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "displayName",
      header: "Display Name",
      cell: ({ row }) => (
        <span>{row.original.displayName || "—"}</span>
      ),
    },
    {
      accessorKey: "permissions",
      header: "Role",
      cell: ({ row }) => (
        <Badge variant={row.original.permissions === "admin" ? "default" : "secondary"}>
          {row.original.permissions}
        </Badge>
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
        <span>
          {new Date(row.original.createdAt).toLocaleDateString()}
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
              <Link href={`/adm/users/${row.original.id}`}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDeactivate(row.original.id, row.original.isActive)}
              className="text-destructive"
            >
              <UserX className="h-4 w-4 mr-2" />
              {row.original.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleDeactivate = async (id: string, isCurrentlyActive: boolean) => {
    const action = isCurrentlyActive ? "deactivate" : "activate";
    const confirmed = await confirm({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
      description: `Are you sure you want to ${action} this user?`,
      confirmText: action.charAt(0).toUpperCase() + action.slice(1),
      variant: isCurrentlyActive ? "destructive" : "default",
    });

    if (confirmed) {
      try {
        await api.put(`/adm/users/${id}`, { isActive: !isCurrentlyActive });
        toast.success(`User ${action}d successfully`);
        mutate();
      } catch (error) {
        toast.error(`Failed to ${action} user`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Users Management</h1>
        <Button asChild>
          <Link href="/adm/users/create">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add User
          </Link>
        </Button>
      </div>

      <DashboardSearch placeholder="Search users..." />

      <DataTable columns={columns} data={data} />

      <DashboardPaginate total={total} perPage={perPage} loading={totalLoading} />

      <ConfirmDialog />
    </div>
  );
}