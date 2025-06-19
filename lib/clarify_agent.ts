import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";
dotenv.config();

const chat = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.3,
});

export async function clarifyQuestion(userQuery: string): Promise<string[]> {
  const messages = [
    new SystemMessage(
      `You are a helpful research assistant for health and fitness topics.
      For every user query, your job is to break it down into 2–4 precise, researchable sub-questions
      that could be answered by searching peer-reviewed scientific literature.
      These should be highly specific and clearly written, to enable a search agent to find concrete, evidence-based answers.
      Always return ONLY a valid JSON array of strings—no extra explanation, no markdown, no commentary.`
    ),
    new HumanMessage(
      `Query: "${userQuery}"`
    ),
  ];

  const response = await chat.call(messages);

  let content = response.content as string;

  // Strip markdown code block formatting if present
  if (content.trim().startsWith("```")) {
    content = content.replace(/```(?:json)?\n?/i, "").replace(/```$/, "").trim();
  }

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
      return parsed;
    }
    throw new Error("Not a string[] array");
  } catch (e) {
    console.error("❌ Failed to parse clarifyAgent response:", content, e);
    return [];
  }
}
