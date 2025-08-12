import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { faqs } from "@/db/schema";
import { generateEmbedding } from "@/lib/ai";

export const embeddingFaq = async (payload: { faqId: number }) => {
  const { faqId } = payload;
  
  const faq = await db.query.faqs.findFirst({
    where: eq(faqs.id, faqId),
  });

  if (!faq) {
    throw new Error(`FAQ with ID ${faqId} not found`);
  }

  const embedding = await generateEmbedding(faq.content, "embedding-faq", { skipCache: true });

  await db
    .update(faqs)
    .set({
      embedding,
    })
    .where(eq(faqs.id, faqId));

  console.log(`Generated embedding for FAQ ${faqId}`);
};