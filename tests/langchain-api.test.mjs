import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function compile(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [name, url] of Object.entries(imports)) code = code.replace(JSON.stringify(name), JSON.stringify(url));
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const parser = await compile("../src/services/parse-analysis.ts");
const { analyzeWithLangChain } = await import(await compile("../src/services/langchain-api.ts", { "@/services/parse-analysis": parser }));
const { analyzeProduct } = await import(await compile("../src/services/api.ts", { "@/services/parse-analysis": parser }));
const url = "https://www.amazon.in/dp/B0FIXTURE1";
const result = {
  status: "insufficient_evidence", verdict: "insufficient_evidence", summary: "Fixture: access restricted.",
  product: { asin: "B0FIXTURE1", title: "Fixture product", url },
  reasons: [], reviews: [], coverage: { reviews_analyzed: 0, limitations: ["Fixture"] }, cached: false,
};

test("HTTP and LangChain submit independently to their own endpoint using the same parser", async t => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (target, options) => {
    requests.push({ target, options });
    return Response.json(result);
  });
  const signal = new AbortController().signal;
  assert.equal((await analyzeProduct(url, signal)).verdict, "insufficient_evidence");
  assert.equal((await analyzeWithLangChain(url, signal)).verdict, "insufficient_evidence");
  assert.equal(requests.length, 2);
  assert.ok(requests[0].target.endsWith("/api/v1/analysis"));
  assert.ok(requests[1].target.endsWith("/api/v1/analysis/langchain"));
  assert.equal(requests[1].options.signal, signal);
  assert.equal(requests[1].options.method, "POST");
  assert.deepEqual(JSON.parse(requests[1].options.body), { url });
});

test("Lab access errors are actionable and do not trigger retries", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ detail: "LangChain Lab is disabled on this backend." }, { status: 404 }));
  await assert.rejects(analyzeWithLangChain(url, new AbortController().signal), /LangChain analysis failed \(404\).*disabled/);
  assert.equal(mock.mock.callCount(), 1);
});

test("Lab rejects malformed evidence without fallback to HTTP", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ ...result, verdict: "invalid" }));
  await assert.rejects(analyzeWithLangChain(url, new AbortController().signal), /invalid analysis/);
  assert.equal(mock.mock.callCount(), 1);
});
