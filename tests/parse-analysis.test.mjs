import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = await readFile(new URL("../src/services/parse-analysis.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { parseAnalysis } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
const reportSource = await readFile(new URL("../src/services/report.ts", import.meta.url), "utf8");
const reportCompiled = ts.transpileModule(reportSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { overallPercentages, sampleGroups, reportText, verdictLabels } = await import(`data:text/javascript;base64,${Buffer.from(reportCompiled.outputText).toString("base64")}`);

function response() {
  return {
    status: "completed",
    product: {
      asin: "B0FIXTURE1", title: "Fixture product", url: "https://www.amazon.in/dp/B0FIXTURE1",
      overall_rating: 3.4, rating_count: 373,
      rating_distribution: [{ stars: 5, percentage: 45 }, { stars: 1, percentage: 26 }],
    },
    verdict: "proceed_with_caution", summary: "Two sampled reviewers report weak adhesive.",
    reasons: [{ text: "Weak adhesive", review_ids: ["R1", "R2"] }],
    reviews: [
      { id: "R1", title: "Weak adhesive", text: "The adhesive is weak.", stars: 1, date: "15 November 2026", date_iso: "2026-11-15", variant: null, source_url: "https://www.amazon.in/gp/customer-reviews/R1" },
      { id: "R2", title: null, text: "The tape failed after a day.", stars: 2, date: null, date_iso: null, variant: null, source_url: "https://www.amazon.in/gp/customer-reviews/R2" },
    ],
    positive_findings: [],
    negative_findings: [{ text: "Weak adhesive", review_ids: ["R1"], evidence: [{ review_id: "R1", quote: "The adhesive is weak." }] }],
    recurring_issues: [{ text: "Adhesive concerns recur", review_ids: ["R1", "R2"], evidence: [{ review_id: "R1", quote: "The adhesive is weak." }, { review_id: "R2", quote: "The tape failed after a day." }], category: "product_defect", mention_count: 2 }],
    sample_statistics: { by_star: { "1": 1, "2": 1, "3": 0, "4": 0, "5": 0 }, negative_count: 2, positive_count: 0, neutral_count: 0, unrated_count: 0, oldest_review_date: "2026-11-15", newest_review_date: "2026-11-15" },
    coverage: { reviews_analyzed: 2, limitations: ["Fixture sample"] }, cached: true,
  };
}

test("Amazon summary findings remain distinct from written-review citations", () => {
  const data = response();
  data.product.customers_say = "Customers report weak adhesive and like the bright colours.";
  data.product.feedback_topics = [{ name: "Adhesive", sentiment: "negative", mention_count: 12, text: "Customers report weak adhesive." }];
  data.amazon_findings = [{ text: "Adhesion is a concern in Amazon's summary.", sentiment: "negative", source: "customers_say", topic: null, quote: "weak adhesive" }];
  const parsed = parseAnalysis(data);
  assert.equal(parsed.amazon_findings[0].source, "customers_say");
  assert.equal(parsed.product.feedback_topics[0].positive_count, null);
  assert.match(reportText(parsed), /AMAZON AI-GENERATED CUSTOMER SUMMARY/);
  assert.match(reportText(parsed), /Topic mentions are not failure rates/);
  data.amazon_findings[0].quote = "It exploded";
  assert.throws(() => parseAnalysis(data), /invalid analysis/);
});

test("missing Amazon summaries and partial topics remain unavailable", () => {
  const data = response();
  data.product.feedback_topics = [{ name: "Quality" }];
  const parsed = parseAnalysis(data);
  assert.equal(parsed.product.customers_say, null);
  assert.equal(parsed.product.feedback_topics[0].sentiment, null);
  assert.equal(parsed.product.feedback_topics[0].mention_count, null);
  assert.deepEqual(parsed.amazon_findings, []);
});

test("a negative quoted finding can come from a mixed topic without relabelling its source", () => {
  const data = response();
  data.product.feedback_topics = [{ name: "Quality", sentiment: "mixed", text: "Some like it, while others report faulty products." }];
  data.amazon_findings = [{ text: "Some customers report defects.", source: "topic", topic: "Quality", sentiment: "negative", quote: "faulty products" }];
  const parsed = parseAnalysis(data);
  assert.equal(parsed.product.feedback_topics[0].sentiment, "mixed");
  assert.equal(parsed.amazon_findings[0].sentiment, "negative");
  data.product.feedback_topics[0].sentiment = "positive";
  assert.throws(() => parseAnalysis(data), /invalid analysis/);
});

test("existing report cards render separately labelled Amazon sources and scoped review links", async () => {
  const component = await readFile(new URL("../src/components/analysis-results.tsx", import.meta.url), "utf8");
  let code = ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const name of ["react", "react/jsx-runtime", "lucide-react"]) code = code.replaceAll(JSON.stringify(name), JSON.stringify(import.meta.resolve(name)));
  code = code.replace(JSON.stringify("@/services/report"), JSON.stringify(`data:text/javascript;base64,${Buffer.from(reportCompiled.outputText).toString("base64")}`));
  const { AnalysisResults } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const data = response();
  data.product.customers_say = "Customers report weak adhesive.";
  data.product.feedback_topics = [{ name: "Adhesive", sentiment: "negative", mention_count: 12 }];
  data.amazon_findings = [{ text: "Amazon reports adhesion concerns.", source: "customers_say", topic: null, sentiment: "negative", quote: "weak adhesive" }];
  const html = renderToStaticMarkup(createElement(AnalysisResults, { result: parseAnalysis(data), idPrefix: "langchain-" }));
  assert.match(html, /Amazon AI-generated summary/);
  assert.match(html, /12 mentions/);
  assert.match(html, /Amazon reports adhesion concerns/);
  assert.match(html, /Amazon AI Customers say summary/);
  assert.match(html, /id="langchain-review-R1"/);
  assert.match(html, /href="#langchain-review-R1"/);
  assert.doesNotMatch(html, /class="card amazon-summary"|7\+7\+7|filtered review requests/);
  const compact = renderToStaticMarkup(createElement(AnalysisResults, { result: parseAnalysis(data), idPrefix: "demo-", hideSourceEvidence: true }));
  assert.doesNotMatch(compact, /aria-label="Amazon customer summary"/);
  assert.equal((compact.match(/aria-label="Final verdict"/g) ?? []).length, 1);
  assert.match(compact, /Amazon reports adhesion concerns/);
  const saved = response();
  saved.status = "insufficient_evidence";
  saved.verdict = "insufficient_evidence";
  saved.summary = "LONG_MODEL_PARAGRAPH_SHOULD_NOT_BE_DISPLAYED ".repeat(20);
  saved.reviews = []; saved.reasons = []; saved.sample_statistics = null;
  saved.coverage.reviews_analyzed = 0;
  saved.positive_findings = []; saved.negative_findings = []; saved.recurring_issues = [];
  saved.reliability_findings = []; saved.amazon_findings = [];
  saved.product.rating_distribution = [{ stars: 5, percentage: 44 }, { stars: 4, percentage: 12 }, { stars: 3, percentage: 12 }, { stars: 2, percentage: 6 }, { stars: 1, percentage: 26 }];
  saved.product.feedback_topics = [
    { name: "Appearance", sentiment: "positive", text: "Customers appreciate the appearance." },
    { name: "Adhesive", sentiment: "negative", text: "Customers report poor adhesion." },
    { name: "Reliability", sentiment: "mixed", text: "Customers report mixed reliability." },
  ];
  const demo = renderToStaticMarkup(createElement(AnalysisResults, { result: parseAnalysis(saved), hideSourceEvidence: true, demoMode: true }));
  assert.match(demo, /56% Positive Ratings/);
  assert.match(demo, /aria-label="Overall rating sentiment"/);
  assert.match(demo, /stroke-dasharray="56 44"/);
  assert.match(demo, /stroke-dasharray="12 88"/);
  assert.match(demo, /stroke-dasharray="32 68"/);
  assert.match(demo, /Customers report poor adhesion/);
  assert.doesNotMatch(demo, /Amazon AI customer summary|Amazon AI summary evidence|Cached analysis · no new AI call/);
  assert.doesNotMatch(demo, /Amazon overall ratings\. N\/A|Based on Amazon’s overall star-rating distribution|unavailable buckets stay N\/A/);
  assert.doesNotMatch(demo, /\(Amazon overall ratings\)|\(Amazon ratings\)/);
  assert.doesNotMatch(demo, /More Evidence Needed|LONG_MODEL_PARAGRAPH|Evidence Limitations|Supporting Reviews|Export Report|0 collected|No directly cited/);
});

test("preserves supplied rating metadata, findings and verified source references", () => {
  const parsed = parseAnalysis(response());
  assert.equal(parsed.verdict, "proceed_with_caution");
  assert.deepEqual(parsed.product.rating_distribution, [{ stars: 5, percentage: 45 }, { stars: 1, percentage: 26 }]);
  assert.equal(parsed.recurring_issues[0].mention_count, 2);
  assert.equal(parsed.cached, true);
});

test("accepts legacy results without inventing missing metadata or findings", () => {
  const data = response();
  data.verdict = "buy";
  delete data.product.overall_rating;
  delete data.product.rating_count;
  delete data.product.rating_distribution;
  for (const field of ["positive_findings", "negative_findings", "recurring_issues", "sample_statistics"]) delete data[field];
  for (const review of data.reviews) { delete review.title; delete review.date_iso; }
  const parsed = parseAnalysis(data);
  assert.equal(parsed.verdict, "worth_considering");
  assert.equal(parsed.product.overall_rating, null);
  assert.deepEqual(parsed.product.rating_distribution, []);
  assert.equal(parsed.positive_findings, null);
  assert.equal(parsed.reviews[0].title, null);
});

test("key percentages use the overall histogram and preserve unknown buckets", () => {
  const distribution = [5, 4, 3, 2, 1].map((stars, i) => ({ stars, percentage: [45, 12, 11, 6, 26][i] }));
  assert.deepEqual(overallPercentages(distribution), { positive: 57, neutral: 11, negative: 32 });
  assert.deepEqual(overallPercentages(distribution.slice(1)), { positive: null, neutral: 11, negative: 32 });
  assert.deepEqual(overallPercentages([]), { positive: null, neutral: null, negative: null });
});

test("sample composition handles empty, missing and unrated categories", () => {
  assert.deepEqual(sampleGroups([]).map(g => g.count), [0, 0, 0, 0]);
  const data = parseAnalysis(response());
  assert.deepEqual(sampleGroups(data.reviews).map(g => g.count), [0, 0, 2, 0]);
  assert.deepEqual(sampleGroups([...data.reviews, { ...data.reviews[0], stars: null }]).map(g => g.count), [0, 0, 2, 1]);
});

test("all verdict states export the actual counts, quotes and limitations", () => {
  for (const verdict of Object.keys(verdictLabels)) {
    const data = parseAnalysis({ ...response(), verdict });
    const report = reportText(data);
    assert.match(report, new RegExp(verdictLabels[verdict]));
    assert.match(report, /2 collected; 2 AI analyzed/);
    assert.match(report, /The adhesive is weak/);
    assert.match(report, /Fixture sample/);
    assert.match(report, /not a measure of overall satisfaction/);
    assert.doesNotMatch(report, /21 AI analyzed|₹2,499/);
  }
});

test("optional product details and reliability citations are validated", () => {
  const data = response();
  data.product.image_url = "https://m.media-amazon.com/images/I/fixture.jpg";
  data.product.price_text = "₹699.00";
  data.product.specifications = [{ label: "Power", value: "5 V" }];
  data.reliability_findings = data.negative_findings;
  data.key_takeaway = "Check installation.";
  const parsed = parseAnalysis(data);
  assert.equal(parsed.product.price_text, "₹699.00");
  assert.equal(parsed.reliability_findings.length, 1);
  assert.match(reportText(parsed), /Power: 5 V/);
  data.product.image_url = "https://evil.example/image.jpg";
  assert.throws(() => parseAnalysis(data), /invalid analysis/);
  data.product.image_url = null;
  data.reliability_findings = [{ ...data.negative_findings[0], evidence: [{ review_id: "R1", quote: "Fake durability" }] }];
  assert.throws(() => parseAnalysis(data), /invalid analysis/);
});

for (const [name, mutate] of [
  ["unsafe product links", data => { data.product.url = "javascript:alert(1)"; }],
  ["unsafe review links", data => { data.reviews[0].source_url = "https://amazon.in.attacker.test/review"; }],
  ["malformed nested limitations", data => { data.coverage.limitations = "not an array"; }],
  ["invalid verdicts including inherited object names", data => { data.verdict = "__proto__"; }],
  ["invented references", data => { data.reasons[0].review_ids = ["invented"]; }],
  ["unsupported quotes", data => { data.negative_findings[0].evidence[0].quote = "It exploded"; }],
  ["invalid star percentages", data => { data.product.rating_distribution[0].percentage = 101; }],
  ["duplicate histogram buckets", data => { data.product.rating_distribution.push({ stars: 5, percentage: 10 }); }],
  ["inconsistent sample counts", data => { data.sample_statistics.negative_count = 1; }],
  ["invalid recurring counts", data => { data.recurring_issues[0].mention_count = 3; }],
  ["invalid calendar dates", data => { data.reviews[0].date_iso = "2026-02-30"; }],
]) {
  test(`rejects ${name} with a recoverable response error`, () => {
    const data = response();
    mutate(data);
    assert.throws(() => parseAnalysis(data), /server returned an invalid analysis/);
  });
}
