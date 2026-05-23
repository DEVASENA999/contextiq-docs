import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1";

async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch(`${LOVABLE_AI_URL}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: text,
      dimensions: 1536,
    }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

export const askQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      conversationId: z.string().uuid(),
      question: z.string().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      user_id: userId,
      role: "user",
      content: data.question,
    } as never);

    // Get prior messages for context
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Semantic search
    const queryEmb = await embed(data.question);
    const { data: matches } = await supabase.rpc("match_document_chunks", {
      query_embedding: queryEmb as never,
      match_count: 6,
    });

    const context_chunks = (matches ?? []) as Array<{
      id: string;
      document_id: string;
      content: string;
      similarity: number;
      filename: string;
    }>;

    const contextBlock = context_chunks.length
      ? context_chunks
          .map((c, i) => `[Source ${i + 1} — ${c.filename}]\n${c.content}`)
          .join("\n\n---\n\n")
      : "No relevant documents found in the user's library.";

    const systemPrompt = `You are a precise document intelligence assistant. Answer the user's question using ONLY the provided sources from their document library. Cite sources inline as [Source N]. If the answer is not in the sources, say so plainly and suggest what document might help.

Sources:
${contextBlock}`;

    const res = await fetch(`${LOVABLE_AI_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in workspace settings.");
      throw new Error(`AI error: ${res.status} ${t}`);
    }

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const answer = json.choices[0]?.message?.content ?? "";

    const sources = context_chunks.map((c) => ({
      document_id: c.document_id,
      filename: c.filename,
      similarity: c.similarity,
      excerpt: c.content.slice(0, 240),
    }));

    await supabase.from("messages").insert({
      conversation_id: data.conversationId,
      user_id: userId,
      role: "assistant",
      content: answer,
      sources: sources as never,
    } as never);

    // Touch conversation
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.conversationId);

    return { answer, sources };
  });
