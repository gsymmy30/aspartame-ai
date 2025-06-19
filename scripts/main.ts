import { resilientPubMedSearch } from "./agents/search_agent";
import { summarizePapers } from "./agents/summarizer_agent";

// You can also grab the user question from process.argv or stdin if you want
const userQuestion =
  process.argv.slice(2).join(" ") ||
  "What are the long-term health effects of aspartame?";

(async () => {
  console.log("\n🔎 Searching PubMed for:", userQuestion);
  const { papers, queryUsed, reformulated } = await resilientPubMedSearch(userQuestion);

  if (!papers.length) {
    console.log("\n❌ No relevant research papers found on PubMed for this query.");
    if (reformulated && reformulated !== queryUsed) {
      console.log(`Tried reformulation: "${reformulated}"`);
    }
    return;
  }

  console.log(
    `\n✅ Found ${papers.length} relevant research paper${papers.length > 1 ? "s" : ""}.${
      reformulated ? ` (Query was reformulated for better PubMed results: "${reformulated}")` : ""
    }\n`
  );

  // Print titles for debugging, optional
  papers.forEach((p, i) => {
    console.log(`[${i + 1}] ${p.title} (${p.url})`);
  });

  // Summarize the results using LangChain-powered agent
  const summary = await summarizePapers(userQuestion, papers);

  console.log("\n🔬 Research-backed summary:\n");
  console.log(summary);
})();
