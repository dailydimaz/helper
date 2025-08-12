# Modern Web Application Boilerplate Template

## Overview
Create a modern web application using Next.js with a complete content management system, including admin dashboard and public pages. The application should follow proven architectural patterns and standardization for scalability and maintainability.

## Required Tech Stack

### Frontend Framework
- **Next.js 15** with App Router
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **ShadCN/UI** for UI components

### Database & ORM
- **PostgreSQL** as primary database
- **Drizzle ORM** for database operations
- **Drizzle Kit** for migrations

### State Management & Data Fetching
- **SWR** for global state management and data fetching
- **React Hook Form** with **Zod validation** for form handling

### Authentication & Security
- **JWT** with **Jose** library for authentication
- **Argon2** for password hashing
- Cookie-based session management

### JavaScript Runtime & Package Manager
- **Bun** as JavaScript runtime and package manager

### Additional Libraries
- **CKEditor 5** for rich text editor
- **React Dropzone** for file upload
- **Sonner** for toast notifications
- **Lucide React** for icons

## Struktur Database Schema (Drizzle)

### Schema Naming Standards
```typescript
// Use consistent naming conventions:
// - Table names: camelCase with 'Table' suffix (example: usersTable, articlesTable)
// - Column names: camelCase
// - Foreign keys: [entityName]Id (example: authorId, categoryId)
// - Timestamps: createdAt, updatedAt
// - Boolean fields: is[Property] (example: isPublished, isActive)

export const usersTable = pgTable("users", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
  role: varchar({ length: 255 }).notNull(),
  password: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Example table with relations
export const articlesTable = pgTable("articles", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull(),
  slug: varchar({ length: 255 }).notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => usersTable.id),
  isPublished: boolean("is_published").default(false),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  thumbnail: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Define relations
export const articleRelations = relations(articlesTable, ({ one }) => ({
  author: one(usersTable, {
    fields: [articlesTable.authorId],
    references: [usersTable.id],
  }),
  category: one(categoriesTable, {
    fields: [articlesTable.categoryId],
    references: [categoriesTable.id],
  }),
}));
```

## Layout with ShadCN

### ShadCN Setup
```json
// components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### Required UI Components
Install the following ShadCN components:
- `button`, `input`, `label`, `form`
- `table`, `data-table`, `pagination`
- `dialog`, `alert-dialog`, `confirm-dialog`
- `dropdown-menu`, `select`, `checkbox`
- `badge`, `card`, `separator`
- `tabs`, `sheet`, `drawer`
- `sonner` for toast notifications

## Context Provider Implementation

### App Context Provider
```typescript
// hooks/use-app.tsx
"use client";
import { createContext, useContext } from "react";
import { SWRConfig } from "swr";
import { useApi } from "./use-api";
import { Toaster } from "@/components/ui/sonner";

function useAppContext({ basePath }: { basePath: string }) {
  return { basePath };
}

export const AppContext = createContext<ReturnType<typeof useAppContext> | null>(null);

export function useApp() {
  return useContext(AppContext) as ReturnType<typeof useAppContext>;
}

export const AppContextProvider = ({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath: string;
}) => {
  const values = useAppContext({ basePath });
  return (
    <AppContext.Provider value={values}>
      <SWRProvider>{children}</SWRProvider>
    </AppContext.Provider>
  );
};

function SWRProvider({ children }: { children: React.ReactNode }) {
  const { get } = useApi();
  return (
    <SWRConfig
      value={{
        fetcher: (url) => get(url).then((res) => res),
      }}
    >
      {children}
      <Toaster />
    </SWRConfig>
  );
}
```

### User Context Implementation
```typescript
// hooks/use-user.tsx
import { useMemo } from "react";
import useSWR from "swr";

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR("/adm/me");

  const user = useMemo(() => {
    if (error || isLoading) return null;
    return data?.data;
  }, [data, error, isLoading]);

  const status = useMemo(() => {
    if (error) return "unauthenticated";
    if (isLoading) return "loading";
    return "authenticated";
  }, [error, isLoading]) as "loading" | "unauthenticated" | "authenticated";

  return { user, status, reload: mutate };
}
```

### Admin Provider for Protected Routes
```typescript
// components/admin-provider.tsx
"use client";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminProvider({ children }: { children: React.ReactNode }) {
  const { status } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/adm/login");
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="size-10 animate-spin" />
      </div>
    );
  }

  if (status !== "authenticated") return <></>;
  return <>{children}</>;
}
```

## Hook API Implementation

### useApi Hook
```typescript
// hooks/use-api.tsx
import { useEffect, useRef } from "react";
import { useApp } from "./use-app";

type Options = RequestInit & { noAbort?: boolean };

export const useApi = () => {
  const { basePath } = useApp();
  const abortRef = useRef<Map<AbortController, boolean>>(new Map());

  const handleOptions = (method: string, body?: any, opts?: Options) => {
    const extraHeaders = opts?.headers || {};
    const options: Options = {
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...extraHeaders,
      },
      method,
      noAbort: opts?.noAbort,
    };

    if (body instanceof FormData) {
      options.body = body;
    } else if (body) {
      (options.headers as Record<string, string>)["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    return options;
  };

  const request = async (url: string, options: Options) => {
    const ctrl = new AbortController();
    if (!options.noAbort) {
      abortRef.current.set(ctrl, true);
      options.signal = ctrl.signal;
    }

    try {
      const response = await fetch(`${basePath}/api${url}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw { ...data, code: response.status };
      }

      return data;
    } finally {
      if (!options.noAbort) {
        abortRef.current.delete(ctrl);
      }
    }
  };

  return {
    get: (url: string, opts?: Options) => request(url, handleOptions("GET", null, opts)),
    post: (url: string, body?: any, opts?: Options) => request(url, handleOptions("POST", body, opts)),
    put: (url: string, body?: any, opts?: Options) => request(url, handleOptions("PUT", body, opts)),
    delete: (url: string, opts?: Options) => request(url, handleOptions("DELETE", null, opts)),
  };
};
```

### useTable Hook for Data Management
```typescript
// hooks/use-table.tsx
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import useSWR from "swr";

export function useTable({ pathname, perPage = 10 }) {
  const query = useSearchParams();

  const dataURL = useMemo(() => {
    const p = new URL("https://example.com" + pathname);
    p.searchParams.set("perPage", perPage.toString());
    p.searchParams.set("page", query.get("page") || "1");
    if (query.get("q")) p.searchParams.set("q", query.get("q"));
    return p.pathname + p.search;
  }, [pathname, perPage, query]);

  const dataSwr = useSWR(dataURL);

  const paginateURL = useMemo(() => {
    const p = new URL("https://example.com" + pathname);
    if (query.get("q")) p.searchParams.set("q", query.get("q"));
    p.searchParams.set("countOnly", "true");
    return p.pathname + p.search;
  }, [pathname, query]);

  const paginateSwr = useSWR(paginateURL);

  return {
    data: dataSwr?.data?.data || [],
    isLoading: dataSwr.isLoading,
    error: dataSwr.error,
    totalLoading: paginateSwr.isLoading,
    total: paginateSwr?.data?.total || -1,
    perPage,
    mutate: async () => {
      await dataSwr.mutate();
      paginateSwr.mutate();
    },
  };
}
```

## Admin Backoffice Implementation

### Admin Routing Structure
```
app/
├── (adm)/
│   └── adm/
│       ├── login/
│       │   └── page.tsx
│       └── (authenticated)/
│           ├── layout.tsx          #// Wrap with AdminProvider
│           ├── dashboard/
│           │   └── page.tsx
│           ├── articles/
│           │   ├── page.tsx        # List articles
│           │   ├── create/
│           │   │   └── page.tsx    # Create form
│           │   └── [id]/
│           │       └── page.tsx    # Edit form
│           ├── categories/
│           ├── products/
│           └── settings/
```

### Admin Layout with Sidebar
```typescript
// app/(adm)/adm/(authenticated)/layout.tsx
import AdminProvider from "@/components/admin-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <SidebarProvider>
        <AppSidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </SidebarProvider>
    </AdminProvider>
  );
}
```

## CRUD Pages Standardization

### 1. List Page with Search, Sort, Pagination
```typescript
// Template for list page
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
import { MoreHorizontal, PlusIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ListPage() {
  const api = useApi();
  const { data, total, totalLoading, mutate, perPage } = useTable({
    pathname: "/adm/[entity]",
    perPage: 10,
  });
  const deleteModal = useConfirm();

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "id",
      header: "ID",
      meta: { width: "1%" },
    },
    {
      accessorKey: "title",
      header: "Title",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? "secondary" : "outline"}>
          {row.original.isActive ? "Active" : "Inactive"}
        </Badge>
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
          <DropdownMenuContent>
            <DropdownMenuItem asChild>
              <Link href={`/adm/[entity]/${row.original.id}`}>Edit</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleDelete(row.original.id)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleDelete = async (id: number) => {
    const confirmed = await deleteModal.confirm({
      title: "Delete Item",
      description: "Are you sure you want to delete this item?",
    });

    if (confirmed) {
      try {
        await api.delete(`/adm/[entity]/${id}`);
        toast.success("Item deleted successfully");
        mutate();
      } catch (error) {
        toast.error("Failed to delete item");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">[Entity] Management</h1>
        <Button asChild>
          <Link href="/adm/[entity]/create">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add New
          </Link>
        </Button>
      </div>

      <DashboardSearch placeholder="Search [entity]..." />

      <DataTable columns={columns} data={data} />

      <DashboardPaginate total={total} perPage={perPage} loading={totalLoading} />
    </div>
  );
}
```

### 2. Create/Edit Form
```typescript
// Template for create/edit form
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { handleApiErr } from "@/lib/handle-api-err";
import { [entity]Schema } from "@/lib/validation/schema";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";

export default function EntityForm({ id }: { id?: string }) {
  const api = useApi();
  const router = useRouter();
  const isEdit = !!id;

  const { data: item } = useSWR(isEdit ? `/adm/[entity]/${id}` : null);

  const form = useForm({
    resolver: zodResolver([entity]Schema),
    defaultValues: {
      title: "",
      description: "",
      isActive: true,
      ...item?.data,
    },
  });

  const onSubmit = async (values: any) => {
    try {
      if (isEdit) {
        await api.put(`/adm/[entity]/${id}`, values);
        toast.success("[Entity] updated successfully");
      } else {
        await api.post("/adm/[entity]", values);
        toast.success("[Entity] created successfully");
      }
      router.push("/adm/[entity]");
    } catch (error) {
      handleApiErr(error, { setError: form.setError });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        {isEdit ? "Edit" : "Create"} [Entity]
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Active</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

## Standard API Handling

### 1. Response Utility
```typescript
// lib/response.ts
import { NextResponse } from 'next/server';

export function toRes(data: {
  message?: string;
  status?: number;
  data?: any;
  errors?: any;
  total?: number;
}) {
  if (!data.status) data.status = 200;
  return NextResponse.json(data, { status: data.status });
}
```

### 2. Error Handling
```typescript
// lib/handle-api-err.ts
import { toast } from 'sonner';

type HandleErrProp = {
  setError?: any;
  onError?: any;
};

export const handleApiErr = (e: any, { setError, onError }: HandleErrProp) => {
  if (e?.errors && typeof setError === "function") {
    Object.keys(e.errors).forEach((key) => {
      setError(key, { message: e.errors[key] });
    });
  } else {
    const message = e?.message || "Something went wrong.";
    if (typeof onError === "function" && !onError(message, e.code)) {
      toast.error(message);
    } else {
      toast.error(message);
    }
  }
};
```

### 3. Validation Utility
```typescript
// lib/validation/index.ts
import { NextRequest } from 'next/server';
import { toRes } from '../response';
import { ZodSchema } from 'zod';

export async function reqValidate(req: NextRequest, schema: ZodSchema) {
  try {
    const body = await req.json();
    const validated = schema.parse(body);
    return { success: true, data: validated };
  } catch (error) {
    if (error.errors) {
      const formattedErrors = {};
      error.errors.forEach((err) => {
        formattedErrors[err.path[0]] = err.message;
      });
      return { success: false, response: toRes({ errors: formattedErrors, status: 400 }) };
    }
    return { success: false, response: toRes({ message: "Invalid request", status: 400 }) };
  }
}
```

### 4. API Route Template
```typescript
// app/api/adm/[entity]/route.ts
import { db } from '@/db';
import { [entity]Table } from '@/db/schema';
import { getLogin } from '@/lib/cookie';
import { parsePaginate } from '@/lib/paginate';
import { toRes } from '@/lib/response';
import { reqValidate } from '@/lib/validation';
import { create[Entity]Schema } from '@/lib/validation/schema';
import { count, desc, like } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import slugify from 'slugify';

// GET - List with pagination and search
export async function GET(req: NextRequest) {
  try {
    const login = await getLogin();
    if (!login) {
      return toRes({ message: "Unauthorized", status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { page, perPage, countOnly } = parsePaginate(searchParams);
    const q = searchParams.get('q') || '';

    if (countOnly) {
      const [totalResult] = await db
        .select({ count: count() })
        .from([entity]Table)
        .where(q ? like([entity]Table.title, `%${q}%`) : undefined);

      return toRes({ total: totalResult.count });
    }

    const data = await db.query.[entity]Table.findMany({
      where: q ? like([entity]Table.title, `%${q}%`) : undefined,
      orderBy: desc([entity]Table.createdAt),
      limit: perPage,
      offset: (page - 1) * perPage,
    });

    return toRes({ data });
  } catch (error) {
    return toRes({ message: "Internal server error", status: 500 });
  }
}

// POST - Create new entity
export async function POST(req: NextRequest) {
  try {
    const login = await getLogin();
    if (!login) {
      return toRes({ message: "Unauthorized", status: 401 });
    }

    const validation = await reqValidate(req, create[Entity]Schema);
    if (!validation.success) {
      return validation.response;
    }

    const { title, ...rest } = validation.data;
    const slug = slugify(title, { lower: true });

    const [newEntity] = await db
      .insert([entity]Table)
      .values({
        title,
        slug,
        ...rest,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return toRes({
      message: "[Entity] created successfully",
      data: newEntity,
      status: 201,
    });
  } catch (error) {
    return toRes({ message: "Internal server error", status: 500 });
  }
}
```

### 5. Authentication Middleware
```typescript
// lib/cookie.ts
import { jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

export async function getLogin() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}
```

## Standard Validation Schema

```typescript
// lib/validation/schema.ts
import z from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
});

// Base entity schema template
export const create[Entity]Schema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  slug: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const update[Entity]Schema = create[Entity]Schema;

// Content schemas
export const createArticleSchema = z.object({
  title: z.string().max(255).min(3),
  content: z.string().max(10000).min(1),
  thumbnail: z.string(),
  categoryId: z.number().min(1, 'Category is required'),
  isPublished: z.boolean(),
});
```

## Project File Structure

```
project-root/
├── app/
│   ├── (adm)/
│   │   └── adm/
│   │       ├── login/
│   │       │   └── page.tsx
│   │       └── (authenticated)/
│   │           ├── layout.tsx
│   │           ├── dashboard/
│   │           ├── articles/
│   │           ├── products/
│   │           └── settings/
│   ├── api/
│   │   ├── auth/
│   │   └── adm/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/           # ShadCN components
│   ├── admin-provider.tsx
│   ├── data-table.tsx
│   └── app-provider.tsx
├── hooks/
│   ├── use-api.tsx
│   ├── use-user.tsx
│   ├── use-table.tsx
│   └── use-app.tsx
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   ├── response.ts
│   ├── handle-api-err.ts
│   ├── utils.ts
│   └── validation/
│       └── schema.ts
├── db/
│   ├── schema.ts
│   └── migrations/
├── drizzle.config.ts
├── next.config.js
├── tailwind.config.js
├── components.json
├── .env.local
└── package.json
```

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Next.js
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
```

## Package.json Dependencies

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.0",
    "@radix-ui/react-*": "latest",
    "argon2": "^0.43.1",
    "ckeditor5": "^46.0.0",
    "drizzle-orm": "^0.44.3",
    "jose": "^6.0.12",
    "lucide-react": "^0.525.0",
    "next": "15.3.5",
    "pg": "^8.16.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-dropzone": "^14.3.8",
    "react-hook-form": "^7.61.1",
    "slugify": "^1.6.6",
    "sonner": "^2.0.6",
    "swr": "^2.3.4",
    "tailwindcss": "^4",
    "zod": "^4.0.10"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/pg": "^8.15.4",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "drizzle-kit": "^0.31.4",
    "typescript": "^5"
  }
}
```

## Implementation Instructions

1. **Setup Project**: Create new Next.js project with TypeScript
   ```bash
   bunx create-next-app@latest my-app --typescript --tailwind --eslint --app
   cd my-app
   ```

2. **Install Dependencies**: Install all required packages
   ```bash
   bun add [dependencies from above]
   bun add -d [devDependencies from above]
   ```
3. **Setup Database**: Configure PostgreSQL and Drizzle ORM
   ```bash
   bun add drizzle-orm postgres
   bun add -d drizzle-kit
   ```

4. **Setup ShadCN**: Install and configure UI components
   ```bash
   bunx shadcn-ui@latest init
   bunx shadcn-ui@latest add button input label form table
   ```

5. **Implement Schema**: Create database schema according to requirements
6. **Implement Context**: Create App Context and User Context
7. **Create Hooks**: Implement useApi, useTable, and other hooks
8. **Build Admin**: Create admin pages with complete CRUD functionality
9. **Implement API**: Create API routes with validation and error handling
10. **Add Authentication**: Implement login system with JWT
11. **Create Public Pages**: Build public pages to display content
12. **Testing**: Test all features and fix bugs
    ```bash
    bun run dev
    ```

This template provides a solid foundation for building modern, scalable, and maintainable web applications with Next.js.