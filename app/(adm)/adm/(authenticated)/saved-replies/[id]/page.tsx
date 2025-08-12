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
import { updateSavedReplySchema } from "@/lib/validation/schema";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { useEffect } from "react";

interface EditSavedReplyPageProps {
  params: {
    id: string;
  };
}

export default function EditSavedReplyPage({ params }: EditSavedReplyPageProps) {
  const api = useApi();
  const router = useRouter();
  const { id } = params;

  const { data: savedReplyData, error } = useSWR(`/adm/saved-replies/${id}`);
  const savedReply = savedReplyData?.data;

  const form = useForm({
    resolver: zodResolver(updateSavedReplySchema),
    defaultValues: {
      name: "",
      content: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (savedReply) {
      form.reset({
        name: savedReply.name,
        content: savedReply.content,
        isActive: savedReply.isActive,
      });
    }
  }, [savedReply, form]);

  const onSubmit = async (values: any) => {
    try {
      await api.put(`/adm/saved-replies/${id}`, values);
      toast.success("Saved reply updated successfully");
      router.push("/adm/saved-replies");
    } catch (error) {
      handleApiErr(error, { setError: form.setError });
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Error</h1>
        <p>Failed to load saved reply data.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!savedReply) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>Loading saved reply data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Saved Reply</h1>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reply Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Welcome Message, FAQ Response..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reply Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the saved reply content here..."
                    className="min-h-[200px]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
                <div className="text-sm text-muted-foreground">
                  You can use HTML formatting and variables like {`{{customerName}}`} in your content.
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active Status</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    When active, this reply will be available for use by support agents
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
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