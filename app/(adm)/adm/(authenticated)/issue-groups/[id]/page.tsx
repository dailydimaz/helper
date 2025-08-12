"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { handleApiErr } from "@/lib/handle-api-err";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { useEffect } from "react";
import z from "zod";

const updateIssueGroupSchema = z.object({
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().optional(),
});

interface EditIssueGroupPageProps {
  params: {
    id: string;
  };
}

export default function EditIssueGroupPage({ params }: EditIssueGroupPageProps) {
  const api = useApi();
  const router = useRouter();
  const { id } = params;

  const { data: issueGroupData, error } = useSWR(`/adm/issue-groups/${id}`);
  const issueGroup = issueGroupData?.data;

  const form = useForm({
    resolver: zodResolver(updateIssueGroupSchema),
    defaultValues: {
      title: "",
      description: "",
    },
  });

  useEffect(() => {
    if (issueGroup) {
      form.reset({
        title: issueGroup.title,
        description: issueGroup.description || "",
      });
    }
  }, [issueGroup, form]);

  const onSubmit = async (values: any) => {
    try {
      await api.put(`/adm/issue-groups/${id}`, values);
      toast.success("Issue group updated successfully");
      router.push("/adm/issue-groups");
    } catch (error) {
      handleApiErr(error, { setError: form.setError });
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Error</h1>
        <p>Failed to load issue group data.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!issueGroup) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>Loading issue group data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Issue Group</h1>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Login Issues, Payment Problems..." {...field} />
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
                  <Textarea
                    placeholder="Describe what types of issues belong to this group..."
                    className="min-h-[120px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-sm text-muted-foreground">
                  This description will help the AI categorize conversations automatically.
                </div>
              </FormItem>
            )}
          />

          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save Changes"}
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