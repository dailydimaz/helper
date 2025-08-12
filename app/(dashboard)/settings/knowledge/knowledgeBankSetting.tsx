"use client";

import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApi } from "@/hooks/use-api";
import useSWR from "swr";
import { mutate } from "swr";
import { handleApiErr } from "@/lib/handle-api-err";
import SectionWrapper from "../sectionWrapper";
import KnowledgeBankItem, { KnowledgeEditForm } from "./knowledgeBankItem";
import SuggestedKnowledgeBankItem from "./suggestedKnowledgeBankItem";

const KnowledgeBankSetting = () => {
  const [newFaqContent, setNewFaqContent] = useState<string>("");
  const [showNewFaqForm, setShowNewFaqForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { post, delete: deleteReq } = useApi();

  const { data: faqsData, isLoading } = useSWR("/faqs");
  const faqs = faqsData?.data || [];

  const filteredFaqs = faqs.filter((faq) => faq.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const suggestedFaqs = filteredFaqs.filter((faq) => faq.suggested && faq.suggestedReplacementForId === null);
  const withSuggestedReplacement = filteredFaqs.flatMap((faq) => {
    const suggestedReplacement = faqs.find((f) => f.suggestedReplacementForId === faq.id);
    return suggestedReplacement ? [{ ...faq, suggestedReplacement }] : [];
  });
  const otherEntries = filteredFaqs.filter(
    (faq) => !faq.suggested && !withSuggestedReplacement.some((f) => f.id === faq.id),
  );

  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const createFaq = async (content: string) => {
    setIsCreating(true);
    try {
      await post("/faqs", { content });
      
      // Invalidate FAQs list to refetch
      await mutate(key => typeof key === 'string' && key.includes('/faqs'));
      
      setShowNewFaqForm(false);
      setNewFaqContent("");
      toast.success("Knowledge created successfully");
    } catch (error) {
      handleApiErr(error, {
        onError: (message) => {
          toast.error("Error creating knowledge", { description: message });
          return true; // Handled
        }
      });
    } finally {
      setIsCreating(false);
    }
  };
  
  const deleteFaq = async (id: number) => {
    setIsDeleting(true);
    try {
      await deleteReq(`/faqs/${id}`);
      
      // Invalidate FAQs list to refetch
      await mutate(key => typeof key === 'string' && key.includes('/faqs'));
      
      toast.success("Knowledge deleted!");
    } catch (error) {
      handleApiErr(error, {
        onError: (message) => {
          toast.error("Error deleting knowledge", { description: message });
          return true; // Handled
        }
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpsertFaq = async () => {
    if (!newFaqContent) return;
    await createFaq(newFaqContent);
  };

  const handleDeleteFaq = async (id: number) => {
    await deleteFaq(id);
  };

  return (
    <SectionWrapper
      title="Knowledge Bank"
      description={
        <>
          <div className="mb-2">
            Record information that you frequently share with customers. Helper will use this to provide consistent,
            accurate, and relevant responses to inquiries.
          </div>
          Helper will suggest improvements to your knowledge bank to ensure it's up to date.
        </>
      }
    >
      <Input
        type="text"
        placeholder="Search knowledge bank..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-4"
      />
      {suggestedFaqs.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="suggested">
            <AccordionTrigger className="hover:no-underline">
              <Badge variant="bright">
                {suggestedFaqs.length} suggested {suggestedFaqs.length === 1 ? "entry" : "entries"}
              </Badge>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {suggestedFaqs.map((faq) => (
                  <SuggestedKnowledgeBankItem key={faq.id} faq={faq} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      <div className="mb-4 divide-y divide-border">
        {isLoading ? (
          <>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-4">
                <div className="grow space-y-2">
                  <div className="h-4 w-32 rounded bg-secondary animate-skeleton" />
                  <div className="h-4 w-48 rounded bg-secondary animate-skeleton" />
                </div>
                <div className="h-6 w-16 rounded bg-secondary animate-skeleton" />
              </div>
            ))}
          </>
        ) : (
          <>
            {withSuggestedReplacement.map((faq) => (
              <KnowledgeBankItem
                key={faq.id}
                faq={faq}
                suggestedReplacement={faq.suggestedReplacement}
                onDelete={() => handleDeleteFaq(faq.id)}
              />
            ))}
            {otherEntries.map((faq) => (
              <KnowledgeBankItem key={faq.id} faq={faq} onDelete={() => handleDeleteFaq(faq.id)} />
            ))}
          </>
        )}
      </div>
      {showNewFaqForm ? (
        <div className="mb-4">
          <KnowledgeEditForm
            content={newFaqContent}
            onChange={setNewFaqContent}
            onSubmit={handleUpsertFaq}
            onCancel={() => {
              setShowNewFaqForm(false);
              setNewFaqContent("");
            }}
            isLoading={isCreating}
          />
        </div>
      ) : (
        <Button
          variant="subtle"
          onClick={(e) => {
            e.preventDefault();
            setNewFaqContent("");
            setShowNewFaqForm(true);
          }}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Knowledge
        </Button>
      )}
    </SectionWrapper>
  );
};

export default KnowledgeBankSetting;
