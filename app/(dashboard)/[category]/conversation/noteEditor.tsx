import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Conversation, Note as NoteType } from "@/app/types/global";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { mutate } from "swr";
import { handleApiErr } from "@/lib/handle-api-err";

interface NoteEditorProps {
  conversation: Conversation;
  note: NoteType;
  isEditing: boolean;
  onCancelEdit: () => void;
  children: React.ReactNode;
}

export const NoteEditor = ({ conversation, note, isEditing, onCancelEdit, children }: NoteEditorProps) => {
  const [editContent, setEditContent] = useState(note.body);
  const [isUpdating, setIsUpdating] = useState(false);
  const { put } = useApi();

  const handleSaveEdit = async () => {
    if (!editContent?.trim()) return;
    
    setIsUpdating(true);
    try {
      await put(`/conversations/${conversation.slug}/notes/${note.id}`, {
        message: editContent.trim(),
      });
      
      // Invalidate conversation data to refetch updated notes
      await mutate(key => 
        typeof key === 'string' && key.includes(`/conversations/${conversation.slug}`)
      );
      
      onCancelEdit();
      toast.success("Note updated successfully");
    } catch (error) {
      handleApiErr(error, {
        onError: (message) => {
          toast.error("Failed to update note", { description: message });
          return true; // Handled
        }
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    onCancelEdit();
    setEditContent(note.body);
  };

  if (isEditing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={editContent || ""}
          onChange={(e) => setEditContent(e.target.value)}
          className="min-h-20 resize-none"
          autoFocus
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating || !editContent?.trim()}>
            <Check className="h-4 w-4 mr-1" />
            {isUpdating ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={isUpdating}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
