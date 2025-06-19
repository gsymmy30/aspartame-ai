import type { NextApiRequest, NextApiResponse } from "next";
import { clarifyQuestion } from "../../lib/clarify_agent";
import { resilientPubMedSearch } from "../../lib/search_agent";
import { summarizePapers } from "../../lib/summarizer_agent";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { question } = req.body;
  if (!question || typeof question !== "string")
    return res.status(400).json({ error: "Missing question." });

  try {
    // 1. Clarify into sub-questions (or fall back to original)
    const clarified: string[] = await clarifyQuestion(question);

    // Try each clarified sub-question (or original if none)
    let results = [];
    let usedSubQuestions: string[] = [];
    let queriesUsed: string[] = [];
    let papers: any[] = [];
    let reformulations: string[] = [];

    const subQuestions = (clarified && clarified.length) ? clarified : [question];

    // For each clarified sub-question, search and collect papers
    for (const subQ of subQuestions) {
      const { papers: foundPapers, queryUsed, reformulated } = await resilientPubMedSearch(subQ);
      if (foundPapers.length) {
        papers = papers.concat(
          foundPapers.filter(
            (p) => !papers.some((existing) => existing.url === p.url)
          )
        );
        usedSubQuestions.push(subQ);
        queriesUsed.push(queryUsed);
        if (reformulated) reformulations.push(reformulated);
      }
    }

    // Fallback: if nothing found, try the original question if it wasn't already tried
    if (!papers.length && !subQuestions.includes(question)) {
      const { papers: fallbackPapers, queryUsed, reformulated } = await resilientPubMedSearch(question);
      if (fallbackPapers.length) {
        papers = fallbackPapers;
        usedSubQuestions.push(question);
        queriesUsed.push(queryUsed);
        if (reformulated) reformulations.push(reformulated);
      }
    }

    if (!papers.length) {
      return res.status(404).json({
        answer: "❌ No relevant research papers found.",
        references: [],
        clarified: clarified,
        usedSubQuestions,
        queriesUsed,
        reformulations,
      });
    }

    // 3. Summarize ALL found papers in context of the original question
    const answer = await summarizePapers(question, papers);

    res.status(200).json({
      answer,
      references: papers.map((p, i) => ({
        n: i + 1,
        title: p.title,
        url: p.url,
      })),
      clarified,
      usedSubQuestions,
      queriesUsed,
      reformulations,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal error", details: String(err) });
  }
}
