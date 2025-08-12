import AdminProvider from "@/components/admin-provider";
import { AdminSidebar } from "@/components/admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <SidebarProvider>
        <AdminSidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarProvider>
    </AdminProvider>
  );
}