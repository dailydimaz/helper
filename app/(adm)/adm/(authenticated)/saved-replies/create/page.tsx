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
import { createSavedReplySchema } from "@/lib/validation/schema";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

const extendedSchema = createSavedReplySchema.extend({
  isActive: z.boolean().default(true),
});

export default function CreateSavedReplyPage() {
  const api = useApi();
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(extendedSchema),
    defaultValues: {
      name: "",
      content: "",
      isActive: true,
    },
  });

  const onSubmit = async (values: any) => {
    try {
      await api.post("/adm/saved-replies", values);
      toast.success("Saved reply created successfully");
      router.push("/adm/saved-replies");
    } catch (error) {
      handleApiErr(error, { setError: form.setError });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Saved Reply</h1>
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
              {form.formState.isSubmitting ? "Creating..." : "Create Saved Reply"}
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