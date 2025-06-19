import axios from "axios";
import pLimit from "p-limit";
import * as dotenv from "dotenv";
dotenv.config();

const MAX_RESULTS = 20;
const RETURN_TOP_N = 5;
const SUMMARY_CHUNK_SIZE = 10;
const FETCH_CONCURRENCY = 3;
const API_KEY = process.env.PUBMED_API_KEY || "";
const RETRY_ATTEMPTS = 3;

// Simple HTML entity decode
function decodeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2013;/g, "–")
    .replace(/&#x2014;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&hellip;/g, "…")
    .replace(/&#x2026;/g, "…");
}

/**
 * General scientific/biomedical synonym swaps.
 * Add more if you find new user question patterns!
 */
const FALLBACKS = [
  (q: string) => q.replace(/caloric content|calorie content/gi, "energy value"),
  (q: string) => q.replace(/long[- ]?term health effects/gi, "safety"),
  (q: string) => q.replace(/determined and verified/gi, "measurement"),
  (q: string) => q.replace(/ingredients/gi, "composition"),
  (q: string) => q.replace(/current scientific research say/gi, "systematic review"),
  (q: string) => q.replace(/do they contribute calories/gi, "nutritional analysis"),
  (q: string) => q.replace(/review/gi, "systematic review"),
  (q: string) => q.replace(/impact/gi, "effect"),
];

/**
 * Extracts keywords from a user’s natural-language question for PubMed search.
 * Strips question words, common filler, and punctuation.
 */
function extractKeywords(question: string): string {
  // Remove question and filler words/phrases
  const toRemove = [
    "what", "who", "when", "where", "why", "how", "does", "do", "did", "is", "are", "was", "were", "the", "in", "on", "of", "and", "for", "to", "with", "about", "this", "that", "any", "current", "present", "say", "tell me", "can you", "give me", "please", "long-term", "long term", "explain", "find", "show", "report"
  ];
  let text = question.toLowerCase();
  for (let word of toRemove) {
    text = text.replace(new RegExp(`\\b${word}\\b`, "g"), "");
  }
  text = text.replace(/[?.,!]/g, ""); // Remove punctuation
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

// Optionally further compress keyword phrases
function simplifyQuery(raw: string): string {
  const fillerWords = new Set([
    "what", "is", "are", "do", "does", "did", "the", "a", "an", "of", "in", "on",
    "to", "and", "with", "for", "by", "about", "that", "this", "it", "any"
  ]);
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, "")
    .split(/\s+/)
    .filter(word => word.length > 2 && !fillerWords.has(word))
    .join(" ");
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

async function safeGet(url: string, retries = RETRY_ATTEMPTS): Promise<any> {
  try {
    const response = await axios.get(url);
    const remaining = parseInt(response.headers["x-ratelimit-remaining"]);
    const retryAfter = parseInt(response.headers["retry-after"]);
    if (!isNaN(remaining) && remaining === 0 && !isNaN(retryAfter)) {
      console.warn(`🛑 PubMed rate limit hit. Sleeping for ${retryAfter} sec`);
      await sleep((retryAfter + 1) * 1000);
    }
    return response.data;
  } catch (err: any) {
    if (err.response?.status === 429 && retries > 0) {
      const wait = parseInt(err.response?.headers["retry-after"] || "3");
      console.warn(`⚠️ 429 error. Retrying in ${wait}s...`);
      await sleep((wait + 1) * 1000);
      return safeGet(url, retries - 1);
    } else {
      throw err;
    }
  }
}

async function fetchSummaryChunks(pmids: string[]): Promise<any> {
  const chunks = chunkArray(pmids, SUMMARY_CHUNK_SIZE);
  const summaryResults: any = {};
  for (const chunk of chunks) {
    const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${chunk.join(",")}&api_key=${API_KEY}`;
    const resp = await safeGet(summaryUrl);
    Object.assign(summaryResults, resp.result);
    await sleep(1200); // ~5 requests/minute
  }
  return summaryResults;
}

async function fetchPapers(ids: string[], summaries: any, query: string) {
  const limit = pLimit(FETCH_CONCURRENCY);
  return Promise.all(
    ids.map((id) =>
      limit(async () => {
        const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&retmode=xml&id=${id}&api_key=${API_KEY}`;
        let xml = "";
        try {
          xml = await safeGet(url);
        } catch (err) {
          return { title: summaries[id]?.title || "", url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, abstract: "", score: 0, type: "" };
        }
        let abstract = "";
        const match = xml.match(/<Abstract>([\s\S]*?)<\/Abstract>/);
        if (match) {
          abstract = match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        }
        const year = summaries[id]?.pubdate?.substring(0, 4) || "1900";
        const journal = summaries[id]?.source || "";
        const rawTitle = summaries[id]?.title || "";
        const title = decodeHTML(rawTitle);
        const absDecoded = decodeHTML(abstract);

        // Add a field if it's a review/meta-analysis
        let type = "";
        if (/meta-?analysis|systematic review/i.test(title) || /meta-?analysis|systematic review/i.test(absDecoded)) {
          type = "review";
        }
        const score = computeScore(query, absDecoded, year, journal, type);
        return { title, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, abstract: absDecoded, score, type };
      })
    )
  );
}

function computeScore(query: string, abstract: string, year: string, journal: string, type: string): number {
  const keywords = query.toLowerCase().split(/\s+/);
  const matchCount = keywords.filter((k) => abstract.toLowerCase().includes(k)).length;
  const yearScore = parseInt(year) >= 2018 ? 2 : 0;
  const keywordScore = matchCount >= 3 ? 2 : matchCount >= 1 ? 1 : 0;
  const peerReviewedScore = journal ? 1 : 0;
  const reviewBonus = type === "review" ? 1 : 0;
  return yearScore + keywordScore + peerReviewedScore + reviewBonus;
}

/**
 * Main resilient agent function:
 * 1. Extracts keywords and simplifies for PubMed
 * 2. Tries fallback rewrites if 0 results
 */
export async function resilientPubMedSearch(originalQuery: string): Promise<{
  queryUsed: string;
  papers: { title: string; url: string; abstract: string; type?: string }[];
  reformulated?: string;
}> {
  const triedQueries = [originalQuery];
  let keyworded = extractKeywords(originalQuery);
  let simplified = simplifyQuery(keyworded);
  let results = await searchPubMed(simplified);

  if (results.length) {
    return { queryUsed: simplified, papers: results };
  }

  for (let syn of FALLBACKS) {
    const altQuery = syn(simplified);
    if (altQuery !== simplified && !triedQueries.includes(altQuery)) {
      triedQueries.push(altQuery);
      results = await searchPubMed(altQuery);
      if (results.length) {
        console.log(`🔄 Reformulated "${simplified}" → "${altQuery}"`);
        return { queryUsed: altQuery, papers: results, reformulated: altQuery };
      }
    }
  }

  return { queryUsed: simplified, papers: [] };
}

// PubMed search core
export async function searchPubMed(query: string): Promise<{ title: string; url: string; abstract: string; type?: string }[]> {
  console.log("🔍 Searching PubMed with query:", query);

  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=${MAX_RESULTS}&term=${encodeURIComponent(query)}&api_key=${API_KEY}`;
  const searchResp = await safeGet(searchUrl);
  const ids = searchResp.esearchresult?.idlist || [];

  if (!ids.length) {
    console.log("⚠️ No PubMed results found.");
    return [];
  }

  const summaries = await fetchSummaryChunks(ids);
  const papers = await fetchPapers(ids, summaries, query);

  return papers
    .filter(p => p.title && p.abstract)
    .sort((a, b) => b.score - a.score)
    .slice(0, RETURN_TOP_N);
}
