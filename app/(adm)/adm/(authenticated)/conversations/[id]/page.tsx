"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useApi } from "@/hooks/use-api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
import { MessageSquare, User, Calendar, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface ConversationDetailsPageProps {
  params: {
    id: string;
  };
}

interface ConversationDetails {
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
  messages?: Array<{
    id: number;
    content: string;
    fromEmail: string;
    createdAt: string;
    isFromCustomer: boolean;
  }>;
}

export default function ConversationDetailsPage({ params }: ConversationDetailsPageProps) {
  const api = useApi();
  const router = useRouter();
  const { id } = params;
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: conversationData, error, mutate } = useSWR(`/adm/conversations/${id}`);
  const { data: usersData } = useSWR("/adm/users");
  
  const conversation: ConversationDetails | null = conversationData?.data;
  const users = usersData?.data || [];

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await api.put(`/adm/conversations/${id}`, { status: newStatus });
      toast.success("Conversation status updated");
      mutate();
    } catch (error) {
      toast.error("Failed to update conversation status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssignmentChange = async (userId: string) => {
    setIsUpdating(true);
    try {
      const assignedToId = userId === "unassign" ? null : userId;
      await api.put(`/adm/conversations/${id}`, { assignedToId });
      toast.success("Conversation assignment updated");
      mutate();
    } catch (error) {
      toast.error("Failed to update conversation assignment");
    } finally {
      setIsUpdating(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Button onClick={() => router.back()} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Error</h1>
        <p>Failed to load conversation details.</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>Loading conversation details...</div>
      </div>
    );
  }

  const statusColors = {
    open: "default",
    closed: "secondary",
    spam: "destructive",
  } as const;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button onClick={() => router.back()} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Conversations
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">
                {conversation.subject || "No subject"}
              </CardTitle>
              <CardDescription>
                Conversation ID: {conversation.id}
              </CardDescription>
            </div>
            <Badge variant={statusColors[conversation.status]}>
              {conversation.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{conversation.fromName || "Unknown"}</div>
                  <div className="text-sm text-muted-foreground">{conversation.toEmailAddress}</div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{conversation.messageCount} messages</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm">Created: {new Date(conversation.createdAt).toLocaleDateString()}</div>
                  <div className="text-sm">Updated: {new Date(conversation.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={conversation.status}
                  onValueChange={handleStatusChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Assigned To</label>
                <Select
                  value={conversation.assignedToId || "unassign"}
                  onValueChange={handleAssignmentChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassign">Unassigned</SelectItem>
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.displayName || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Messages</h3>
            {conversation.messages && conversation.messages.length > 0 ? (
              <div className="space-y-4">
                {conversation.messages.map((message) => (
                  <Card key={message.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium">
                        {message.isFromCustomer ? "Customer" : "Support"}
                        <span className="text-sm text-muted-foreground ml-2">
                          ({message.fromEmail})
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(message.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none">
                      {message.content}
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No messages available.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}