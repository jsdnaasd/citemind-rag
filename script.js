const sampleDocument = `CiteMind RAG is a local-first retrieval augmented generation studio. It demonstrates the core RAG loop without requiring a backend, API key, or vector database. Users paste knowledge text into the browser, build a lightweight index, ask a question, and inspect the retrieved citation cards.

The system splits long text into overlapping chunks. Each chunk is scored against the user query using a compact TF-IDF style lexical vector. This is not a replacement for production embeddings, but it makes the retrieval process visible and easy to understand.

A useful RAG product should make sources visible. CiteMind RAG returns answer text together with citations, similarity scores, and source snippets. This helps users understand why the answer was generated and where the supporting context came from.

Production RAG systems usually include document loaders, parsers, chunking strategy, embedding models, vector stores, hybrid search, reranking, answer generation, evaluation, and observability. CiteMind focuses on a small readable slice of that pipeline.

For product teams, RAG is valuable when private or fast-changing knowledge must be queried reliably. Examples include support docs, legal policies, product specs, research notes, engineering runbooks, and internal knowledge bases.

中文说明：CiteMind RAG 是一个本地优先的 RAG 演示项目，重点展示文档切块、检索排序、引用片段和可解释回答。它不依赖后端，也不需要 API key，适合用来展示 RAG 的核心工作流。`;

const stopwords = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "for", "with", "is", "are", "was", "were", "that", "this", "it", "as", "on", "by", "be", "from", "into", "without", "using", "user", "users"
]);

const els = {
  documentInput: document.querySelector("#document-input"),
  queryInput: document.querySelector("#query-input"),
  chunkSize: document.querySelector("#chunk-size"),
  topK: document.querySelector("#top-k"),
  indexButton: document.querySelector("#index-button"),
  askButton: document.querySelector("#ask-button"),
  resetDocs: document.querySelector("#reset-docs"),
  status: document.querySelector("#index-status"),
  chunkCount: document.querySelector("#chunk-count"),
  answer: document.querySelector("#answer-output"),
  citations: document.querySelector("#citations")
};

let chunks = [];
let docFrequency = new Map();

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopwords.has(word));
}

function splitIntoChunks(text, size) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const output = [];
  const overlap = Math.floor(size * 0.18);
  let cursor = 0;

  while (cursor < cleaned.length) {
    const slice = cleaned.slice(cursor, cursor + size);
    if (slice.trim()) output.push(slice.trim());
    cursor += size - overlap;
  }

  return output.map((content, index) => ({
    id: index + 1,
    content,
    tokens: tokenize(content)
  }));
}

function buildIndex() {
  const size = Number(els.chunkSize.value);
  chunks = splitIntoChunks(els.documentInput.value, size);
  docFrequency = new Map();

  chunks.forEach((chunk) => {
    const unique = new Set(chunk.tokens);
    unique.forEach((token) => {
      docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
    });
  });

  els.status.textContent = "Indexed";
  els.chunkCount.textContent = `${chunks.length} chunks`;
}

function scoreChunk(queryTokens, chunk) {
  const counts = new Map();
  chunk.tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));

  return queryTokens.reduce((score, token) => {
    const tf = counts.get(token) || 0;
    if (!tf) return score;
    const idf = Math.log((chunks.length + 1) / ((docFrequency.get(token) || 0) + 1)) + 1;
    return score + tf * idf;
  }, 0);
}

function retrieve(query, k) {
  const queryTokens = tokenize(query);
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(queryTokens, chunk)
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function synthesizeAnswer(query, results) {
  if (!results.length) {
    return "I could not find enough matching context. Try adding more source text or asking a question that uses terms from the knowledge base.";
  }

  const strongest = results[0].content;
  const sentence = strongest.split(/(?<=[.!?。！？])\s+/)[0] || strongest.slice(0, 180);
  const refs = results.map((result) => `[${result.id}]`).join(" ");

  return `Based on the retrieved context, ${sentence} The strongest supporting chunks are ${refs}. For production use, this answer should be passed to an LLM with the cited chunks as grounded context.`;
}

function renderCitations(results) {
  els.citations.innerHTML = "";
  if (!results.length) {
    els.citations.innerHTML = `<div class="citation-card"><p>No matching chunks yet.</p></div>`;
    return;
  }

  results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "citation-card";
    card.innerHTML = `
      <strong><span>Chunk ${result.id}</span><span>${result.score.toFixed(2)}</span></strong>
      <p>${result.content}</p>
    `;
    els.citations.appendChild(card);
  });
}

function ask() {
  if (!chunks.length) buildIndex();
  const results = retrieve(els.queryInput.value, Number(els.topK.value));
  els.answer.textContent = synthesizeAnswer(els.queryInput.value, results);
  renderCitations(results);
}

els.indexButton.addEventListener("click", buildIndex);
els.askButton.addEventListener("click", ask);
els.resetDocs.addEventListener("click", () => {
  els.documentInput.value = sampleDocument;
  els.queryInput.value = "How does CiteMind make RAG answers easier to verify?";
  buildIndex();
  ask();
});

els.documentInput.value = sampleDocument;
els.queryInput.value = "How does CiteMind make RAG answers easier to verify?";
buildIndex();
ask();
