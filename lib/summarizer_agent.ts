import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";
dotenv.config();

const MODEL = "gpt-4o";

export async function summarizePapers(
  userQuestion: string,
  papers: { title: string; url: string; abstract: string; type?: string }[]
): Promise<string> {
  if (!papers.length) {
    return "❌ No research papers found for your query. Try a different or broader phrasing.";
  }

  let refs = "";
  papers.forEach((p, i) => {
    refs += `Paper [${i + 1}]:\n${p.type === "review" ? "**[Review/Meta-analysis]**\n" : ""}Title: ${p.title}\nURL: ${p.url}\nAbstract: ${p.abstract}\n\n`;
  });

  const prompt = `
You are an expert scientific research assistant for health and fitness. A user has asked: "${userQuestion}"

Below are the abstracts of relevant peer-reviewed papers. Your job is to:
- **Synthesize a clear, accurate, and balanced summary of the evidence.**
- **Start with a "Key Takeaways" section in bullet points** for non-experts, focusing on what a smart health-conscious person should remember or act on.
- Highlight where the evidence is strong, weak, or conflicting. Mention if the research is based on human studies, animals, or reviews/meta-analyses.
- If studies disagree, explain why and what is still unknown.
- Reference each paper as [1], [2], etc., but DO NOT include any reference list at the end.

${refs}

Please format your answer in Markdown.
`;

  const llm = new ChatOpenAI({
    modelName: MODEL,
    temperature: 0.3,
    openAIApiKey: process.env.OPENAI_API_KEY,
    maxTokens: 900,
  });

  const response = await llm.call([new HumanMessage(prompt)]);
  
  if (typeof response === "string") return response;
  if (typeof response?.content === "string") return response.content;
  if (Array.isArray(response?.content)) {
    return response.content.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("\n\n");
  }
  return JSON.stringify(response);
}
