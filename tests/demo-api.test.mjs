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
const api = await compile("../src/services/api.ts", { "@/services/parse-analysis": parser });
const demo = await import(await compile("../src/services/demo-api.ts", { "@/services/parse-analysis": parser, "@/services/api": api }));
const { overallPercentages } = await import(await compile("../src/services/report.ts"));
const product = { id: "prd1", category_id: "led", version: 1, title: "Gesto LED strip", price_text: "₹399", overall_rating: 3.4, rating_count: 374, image_path: "/api/v1/demo/products/prd1/image" };
const report = { status: "completed", verdict: "proceed_with_caution", summary: "Mocked analysis for test only.", product: { asin: "B0D5Q7RWF6", url: "https://www.amazon.in/dp/B0D5Q7RWF6", title: product.title, rating_distribution: [{ stars: 5, percentage: 44 }, { stars: 4, percentage: 12 }, { stars: 3, percentage: 12 }, { stars: 2, percentage: 6 }, { stars: 1, percentage: 26 }] }, reviews: [], reasons: [], coverage: { reviews_analyzed: 0, limitations: ["Test mock; secondary screenshot evidence only."] }, cached: true };

test("browsing categories/products/evidence makes GET requests only", async t => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/categories")) return Response.json([{ id: "led", name: "LED Lights", product_count: 1 }]);
    if (url.endsWith("/products")) return Response.json([product]);
    return Response.json({ id: "prd1", version: 1, product: { customers_say: null, feedback_topics: [] }, limitations: ["Saved evidence"], topic_excerpts: [{ topic: "Quality", text: "Visible excerpt", source_file: "source.png", partial: true }] });
  });
  const signal = new AbortController().signal;
  assert.equal((await demo.getDemoCategories(signal))[0].id, "led");
  assert.equal((await demo.getDemoProducts("led", signal))[0].rating_count, 374);
  assert.equal((await demo.getDemoEvidence("prd1", signal)).topic_excerpts[0].partial, true);
  assert.ok(requests.every(r => !r.options.method || r.options.method === "GET"));
  assert.ok(requests.every(r => !r.url.includes("/analysis")));
});

test("explicit analysis uses saved product endpoint and shared response validation", async t => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => { requests.push({ url, options }); return Response.json(report); });
  const signal = new AbortController().signal;
  const result = await demo.analyzeDemoProduct("prd1", signal);
  assert.ok(requests[0].url.endsWith("/demo/products/prd1/analysis?workflow=httpx"));
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.signal, signal);
  assert.equal(result.cached, true);
  assert.equal(result.reviews.length, 0);
  assert.deepEqual(overallPercentages(result.product.rating_distribution), { positive: 56, neutral: 12, negative: 32 });
  await demo.analyzeDemoProduct("prd1", signal, "langchain");
  assert.ok(requests[1].url.endsWith("workflow=langchain"));
});

test("malformed catalog, remote images and unsupported evidence are rejected", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json([{ ...product, image_path: "https://untrusted.test/image" }]));
  await assert.rejects(demo.getDemoProducts("led", new AbortController().signal), /invalid saved product/);
  mock.mock.mockImplementation(async () => Response.json({ ...report, verdict: "invented" }));
  await assert.rejects(demo.analyzeDemoProduct("prd1", new AbortController().signal), /invalid analysis/);
});

test("budget/access errors remain visible and never retry", async t => {
  const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ detail: "Shared AI budget storage is unavailable." }, { status: 503 }));
  await assert.rejects(demo.analyzeDemoProduct("prd1", new AbortController().signal), /budget storage/);
  assert.equal(mock.mock.callCount(), 1);
});
