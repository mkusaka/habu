/**
 * GPT model comparison script for habu bookmark suggestion use cases.
 *
 * Compares gpt-5-mini (current), gpt-5.4-mini, and gpt-5.4-nano across:
 *   - Summary generation (structured output, Japanese, 70-100 chars)
 *   - Summary judge (quality evaluation)
 *   - Tags generation (structured output, max 10 chars each)
 *   - Tags judge (quality evaluation)
 *
 * Usage:
 *   npx tsx scripts/eval-models.ts
 */

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

// Load .env.local manually (no dotenv dependency)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  const value = trimmed.slice(eqIdx + 1);
  if (!process.env[key]) process.env[key] = value;
}

const openai = createOpenAI();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MODELS = ["gpt-5-mini", "gpt-5.4-mini", "gpt-5.4-nano"] as const;
type ModelId = (typeof MODELS)[number];

// Pricing per 1M tokens (USD)
const PRICING: Record<ModelId, { input: number; output: number }> = {
  "gpt-5-mini": { input: 0.25, output: 2.0 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
};

// Test URLs from the user's Hatena Bookmarks (diverse genres)
const TEST_CASES: { url: string; title: string; markdown: string }[] = [
  {
    url: "https://thoughtbot.com/blog/testing-is-software-engineering",
    title: "Testing is software engineering",
    markdown: `Testing is Software Engineering. The practice of writing tests is not separate from software engineering — it IS software engineering. When we write tests, we're making design decisions about our code. Tests force us to think about interfaces, dependencies, and behavior. A well-tested codebase is easier to refactor, extend, and maintain. The cost of not testing is technical debt that compounds over time. Testing strategies: unit tests for logic, integration tests for boundaries, E2E tests for user flows. TDD helps clarify requirements before writing code. Tests serve as living documentation.`,
  },
  {
    url: "https://gihyo.jp/article/2026/03/nodejs-vfs",
    title: "Node.js、仮想ファイルシステムを実装へ",
    markdown: `Node.jsに仮想ファイルシステム（VFS）が実装されることが発表された。VFSはNode.jsのSingle Executable Applications（SEA）機能を強化するもので、アプリケーションのバンドルに含まれるファイルをメモリ上の仮想ファイルシステムとして扱えるようになる。これにより、fs.readFileなどの標準APIを使って、バンドル内のファイルにアクセスできる。従来はSEA内のリソースにアクセスするために専用APIが必要だったが、VFSにより既存コードをほぼ変更なく利用可能になる。Node.js 24で実験的機能として導入予定。`,
  },
  {
    url: "https://zenn.dev/rescuenow/articles/7192f8ca6ebe48",
    title: "Playwright + OWASP ZAP + Claude Code でE2Eテストから脆弱性診断まで一気通貫",
    markdown: `PlaywrightでE2Eテストを書き、OWASP ZAPでセキュリティスキャンを行い、Claude Codeで脆弱性の分析と修正提案を自動化するワークフローを紹介。Playwrightのテストをプロキシ経由でZAPに通すことで、通常のE2Eテスト実行時に同時にセキュリティ診断も行える。ZAPのレポートをClaude Codeに渡して修正コードの生成まで自動化。CI/CDパイプラインに組み込むことで、デプロイ前にセキュリティ問題を検出できる。実際の脆弱性検出例としてXSSやCSRFの検出事例を紹介。`,
  },
  {
    url: "https://www.datadoghq.com/blog/claude-code-monitoring/",
    title: "Monitor Claude Code adoption with Datadog's AI Agents Console",
    markdown: `Datadog has launched AI Agents Console to monitor Claude Code usage across engineering teams. The console provides visibility into how developers use AI coding assistants, tracking metrics like token usage, session duration, tool calls, and code acceptance rates. It integrates with existing Datadog dashboards for unified observability. Key features include: per-developer usage analytics, cost tracking by team/project, code quality correlation metrics, and security audit trails. The tool helps engineering leaders understand ROI and adoption patterns.`,
  },
  {
    url: "https://zenn.dev/herp_inc/articles/strange-task-runner",
    title: "Vite+の異常なタスクランナー: vite-task",
    markdown: `Vite+に統合されたタスクランナー「vite-task」の仕組みと設計思想を解説。vite-taskはViteのプラグインシステムを活用してタスクランナー機能を提供する。ファイル監視、依存関係の自動解決、並列実行、キャッシュなどの機能を備える。設定はvite.config.tsに統合でき、別途設定ファイルが不要。主な利点は：（1）Viteのモジュール解決を活用できる（2）HMRと連携してタスクを再実行（3）TypeScriptネイティブ対応（4）Viteエコシステムのプラグインを活用可能。npm scriptsやturborepoと比較した際の利点と欠点も議論。`,
  },
  {
    url: "https://zenn.dev/chiman/articles/b233cc808d6af3",
    title: "Claude Code / CodexでKaggle金メダルを取った話",
    markdown: `Claude CodeとCodexを活用してKaggleコンペティションで金メダルを獲得した体験記。著者はAIコーディングアシスタントを駆使し、特徴量エンジニアリング、モデルチューニング、アンサンブル手法を効率的に実装。Claude Codeでは探索的データ分析のコード生成やハイパーパラメータ探索の自動化に活用。Codexではより長時間の自律的なコード改善に利用。主な知見として、プロンプト設計の工夫、データリーケージの検出、交差検証戦略の最適化などを共有。最終スコアは上位0.5%以内で金メダル獲得。`,
  },
  {
    url: "https://kakehashi-dev.hatenablog.com/entry/2026/03/17/090000",
    title: "Async React の設計思想と Signal の違いを Transition を中心に考える",
    markdown: `ReactのAsync(非同期)パラダイムとSignalベースのリアクティビティの設計思想の違いをTransitionを軸に解説。Reactは状態遷移をTransitionとして扱い、UIの一貫性を保証する。一方SignalはfineGrained reactivityで個別のDOM更新を最適化。ReactのuseTransitionやSuspenseは非同期操作を宣言的に扱えるが、Signal方式より再レンダリングの粒度が粗い。Server ComponentsはAsync Reactの延長線上にあり、サーバーからのストリーミングとTransitionを統合。両アプローチのトレードオフと使い分けを具体的なコード例で示す。`,
  },
  {
    url: "https://cursor.com/blog/security-agents",
    title: "Securing our codebase with autonomous agents",
    markdown: `Cursor describes how they use autonomous AI agents to secure their codebase. The agents continuously scan for vulnerabilities, review pull requests for security issues, and suggest fixes. Key components include: static analysis integration with AI reasoning, dependency vulnerability monitoring, secret scanning with context-aware false positive reduction, and automated security testing. The system runs as part of CI/CD and can block merges when critical issues are found. Results show 40% reduction in security-related incidents and 3x faster vulnerability remediation. The approach combines traditional SAST tools with LLM-powered analysis for better accuracy.`,
  },
  {
    url: "https://tech.findy.co.jp/entry/2026/03/13/070000",
    title: "Findyの爆速開発を支えるセルフレビュー自動化の仕組み",
    markdown: `Findyではプルリクエストのセルフレビューを自動化することで開発速度を大幅に向上させた。具体的には、PR作成時にAIが差分を分析し、チェックリストを自動生成。開発者はチェックリストに沿って確認するだけでセルフレビューが完了する。また、よくある指摘パターンをナレッジベース化し、AIが過去の類似指摘を参照して提案。レビュー待ち時間が平均4時間から1時間に短縮、レビュー差し戻し率も30%減少。GitHub ActionsとOpenAI APIを組み合わせた実装アーキテクチャを紹介。`,
  },
  {
    url: "https://blog.cloudnative.co.jp/articles/ai-agent-zero-trust-implementation/",
    title: "AIエージェントにゼロトラストを適用する — OWASP Agentic Top 10と実装アプローチ",
    markdown: `AIエージェントにゼロトラストアーキテクチャを適用するための実装ガイド。OWASP Agentic Security Top 10を参照し、各脅威に対する具体的な対策を解説。主なリスクとして、プロンプトインジェクション、過剰な権限付与、ツール呼び出しの検証不足、データ漏洩などを挙げる。実装アプローチとして、(1)最小権限の原則をツール呼び出しに適用、(2)入出力のサニタイゼーション、(3)実行コンテキストの分離、(4)監査ログの記録、(5)人間の承認フローの組み込みを推奨。Kubernetes環境でのサンドボックス実装例も提供。`,
  },
  {
    url: "https://arxiv.org/abs/2601.05162",
    title: "GenAI-DrawIO-Creator: A Framework for Automated Diagram Generation",
    markdown: `This paper presents GenAI-DrawIO-Creator, a framework that automatically generates draw.io diagrams from natural language descriptions using large language models. The system takes text input describing a system architecture, workflow, or data flow, and produces structured XML that can be imported into draw.io. The framework uses a multi-stage pipeline: intent classification, entity extraction, relationship mapping, layout optimization, and XML generation. Evaluated on 500 diagram descriptions across 5 categories (architecture, sequence, flowchart, ER, network), achieving 82% structural accuracy and 91% visual readability score. The paper also introduces DiagramBench, a benchmark for automated diagram generation.`,
  },
  {
    url: "https://boristane.com/blog/slop-creep-enshittification-of-software/",
    title: "Slop Creep: The Enshittification of Software by Coding Agents",
    markdown: `Boris Tane argues that AI coding agents are leading to "slop creep" — a gradual degradation of software quality. While agents produce functional code quickly, they often introduce subtle issues: over-abstraction, unnecessary dependencies, inconsistent patterns, and cargo-culted solutions. The author identifies patterns like "abstraction inflation" where agents create unnecessary layers, "dependency bloat" from agents defaulting to npm packages for trivial tasks, and "pattern drift" where agents mix incompatible coding styles. Recommendations include: strict code review of AI output, establishing clear architectural guardrails, using linters and type systems as safety nets, and treating AI-generated code with the same scrutiny as junior developer contributions.`,
  },
  {
    url: "https://agentskills.io/skill-creation/best-practices",
    title: "Best practices for skill creators - Agent Skills",
    markdown: `A comprehensive guide for creating skills for AI coding agents. Best practices include: clear skill descriptions with trigger conditions, minimal dependencies, idempotent operations, and proper error handling. Skills should follow the single responsibility principle and compose well with other skills. The guide covers skill manifest format, testing strategies, versioning, and publishing. Key recommendations: use structured output schemas, provide examples in skill docs, handle edge cases gracefully, support dry-run mode, and include rollback capability. Also covers integration patterns with popular AI agents like Claude Code, Cursor, and Windsurf.`,
  },
  {
    url: "https://docs.github.com/en/code-security/concepts/secret-security/about-secret-security-with-github",
    title: "About secret security with GitHub - GitHub Docs",
    markdown: `GitHub provides multiple layers of secret security to protect repositories. Secret scanning detects over 200 token patterns from partners and custom patterns. Push protection prevents secrets from being committed by blocking pushes containing detected secrets. Secret scanning alerts notify repository admins when secrets are found in code history. GitHub Advanced Security extends scanning to private repos with additional features like AI-powered detection, custom pattern creation, and bypass management. Best practices include: using environment variables, GitHub Secrets for Actions, and credential managers. The docs also cover secret rotation workflows and remediation steps when secrets are exposed.`,
  },
];

// ---------------------------------------------------------------------------
// Schemas (same as production code)
// ---------------------------------------------------------------------------

const SummarySchema = z.object({
  summary: z
    .string()
    .min(10)
    .max(100)
    .describe("Concise summary in Japanese, 70-100 characters."),
});

const JudgeResultSchema = z.object({
  passed: z.boolean().describe("Whether the output meets quality criteria"),
  reason: z.string().describe("Brief explanation"),
});

const TagsSchema = z.object({
  tags: z
    .array(z.string().max(10))
    .max(10)
    .describe("Relevant tags, 3-10 items, each max 10 characters"),
});

// ---------------------------------------------------------------------------
// Task runners
// ---------------------------------------------------------------------------

interface TaskResult {
  model: ModelId;
  task: string;
  testCase: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  output: unknown;
  success: boolean;
  error?: string;
}

async function runSummaryGeneration(
  modelId: ModelId,
  tc: (typeof TEST_CASES)[number],
): Promise<TaskResult> {
  const start = performance.now();
  try {
    const result = await generateObject({
      model: openai(modelId),
      schema: SummarySchema,
      system: `You are a bookmark curator for Hatena Bookmark.
Generate a concise summary that captures what this page offers.
- Language: Japanese only
- Length: 70-100 characters
- Include at least ONE concrete detail from the content
- Keep technical terms in their original form (e.g., "API", "Docker", "React")
- DO NOT invent details not in the content`,
      prompt: `URL: ${tc.url}\nTitle: ${tc.title}\n\n<content>\n${tc.markdown}\n</content>`,
    });
    const latencyMs = performance.now() - start;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    return {
      model: modelId,
      task: "summary-gen",
      testCase: tc.title,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd: calcCost(modelId, inputTokens, outputTokens),
      output: result.object,
      success: true,
    };
  } catch (e) {
    return errorResult(modelId, "summary-gen", tc.title, performance.now() - start, e);
  }
}

async function runSummaryJudge(
  modelId: ModelId,
  tc: (typeof TEST_CASES)[number],
  summary: string,
): Promise<TaskResult> {
  const start = performance.now();
  try {
    const summaryLength = summary.length;
    const result = await generateObject({
      model: openai(modelId),
      schema: JudgeResultSchema,
      system: `You are a quality evaluator for Hatena Bookmark summaries.
Pass if ALL:
1. CONCRETE: Contains specific detail from content
2. ACCURATE: Claims match the content
3. JAPANESE: Written in Japanese
4. LENGTH: 50-100 characters`,
      prompt: `<page_title>${tc.title}</page_title>
<page_content>${tc.markdown}</page_content>
<summary_to_evaluate>${summary}</summary_to_evaluate>
<character_count>Length: ${summaryLength} chars, OK: ${summaryLength >= 50 && summaryLength <= 100 ? "YES" : "NO"}</character_count>`,
    });
    const latencyMs = performance.now() - start;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    return {
      model: modelId,
      task: "summary-judge",
      testCase: tc.title,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd: calcCost(modelId, inputTokens, outputTokens),
      output: result.object,
      success: true,
    };
  } catch (e) {
    return errorResult(modelId, "summary-judge", tc.title, performance.now() - start, e);
  }
}

async function runTagsGeneration(
  modelId: ModelId,
  tc: (typeof TEST_CASES)[number],
): Promise<TaskResult> {
  const start = performance.now();
  try {
    const result = await generateObject({
      model: openai(modelId),
      schema: TagsSchema,
      system: `You are a bookmark curator for Hatena Bookmark. Generate relevant tags.
- Generate 3-5 tags (maximum 10)
- Each tag should be 10 characters or less
- Keep technical terms in original form
- Match content language for non-technical terms
- Include topic tags (what) and type tags (tutorial, news, tool, etc.)
- Order by importance`,
      prompt: `URL: ${tc.url}\nTitle: ${tc.title}\n\n<content>\n${tc.markdown.slice(0, 10000)}\n</content>`,
    });
    const latencyMs = performance.now() - start;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    return {
      model: modelId,
      task: "tags-gen",
      testCase: tc.title,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd: calcCost(modelId, inputTokens, outputTokens),
      output: result.object,
      success: true,
    };
  } catch (e) {
    return errorResult(modelId, "tags-gen", tc.title, performance.now() - start, e);
  }
}

async function runTagsJudge(
  modelId: ModelId,
  tc: (typeof TEST_CASES)[number],
  tags: string[],
): Promise<TaskResult> {
  const start = performance.now();
  try {
    const tagLengthInfo = tags.map((t) => `"${t}": ${t.length}ch ${t.length <= 10 ? "✓" : "✗"}`);
    const result = await generateObject({
      model: openai(modelId),
      schema: JudgeResultSchema,
      system: `You are a quality evaluator for Hatena Bookmark tags.
Pass if ALL:
1. RELEVANT to content
2. SPECIFIC (not generic like "技術", "Web")
3. BALANCED: topic + type tags
4. NO DUPLICATES
5. COUNT: 3-10 tags
6. LENGTH: each ≤10 chars`,
      prompt: `<page_title>${tc.title}</page_title>
<page_content>${tc.markdown}</page_content>
<tags_to_evaluate>${tags.join(", ")}</tags_to_evaluate>
<tag_lengths>${tagLengthInfo.join("\n")}</tag_lengths>`,
    });
    const latencyMs = performance.now() - start;
    const inputTokens = result.usage?.inputTokens ?? 0;
    const outputTokens = result.usage?.outputTokens ?? 0;
    return {
      model: modelId,
      task: "tags-judge",
      testCase: tc.title,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd: calcCost(modelId, inputTokens, outputTokens),
      output: result.object,
      success: true,
    };
  } catch (e) {
    return errorResult(modelId, "tags-judge", tc.title, performance.now() - start, e);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcCost(modelId: ModelId, input: number, output: number): number {
  const p = PRICING[modelId];
  return (input / 1_000_000) * p.input + (output / 1_000_000) * p.output;
}

function errorResult(
  model: ModelId,
  task: string,
  testCase: string,
  latencyMs: number,
  e: unknown,
): TaskResult {
  return {
    model,
    task,
    testCase,
    latencyMs,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    output: null,
    success: false,
    error: e instanceof Error ? e.message : String(e),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== habu Model Evaluation: gpt-5-mini vs gpt-5.4-mini vs gpt-5.4-nano ===\n");
  console.log(`Test cases: ${TEST_CASES.length}`);
  console.log(`Models: ${MODELS.join(", ")}\n`);

  const allResults: TaskResult[] = [];

  for (const tc of TEST_CASES) {
    console.log(`\n--- ${tc.title} ---`);

    // Run all models in parallel for this test case
    const modelResults = await Promise.all(
      MODELS.map(async (modelId) => {
        // 1. Summary generation
        const summaryResult = await runSummaryGeneration(modelId, tc);
        const summary = summaryResult.success
          ? (summaryResult.output as { summary: string }).summary
          : "";

        // 2. Summary judge (using same model to judge its own output)
        const summaryJudgeResult = summary
          ? await runSummaryJudge(modelId, tc, summary)
          : null;

        // 3. Tags generation
        const tagsResult = await runTagsGeneration(modelId, tc);
        const tags = tagsResult.success
          ? (tagsResult.output as { tags: string[] }).tags
          : [];

        // 4. Tags judge
        const tagsJudgeResult = tags.length > 0
          ? await runTagsJudge(modelId, tc, tags)
          : null;

        return { modelId, summaryResult, summaryJudgeResult, tagsResult, tagsJudgeResult };
      }),
    );

    for (const { modelId, summaryResult, summaryJudgeResult, tagsResult, tagsJudgeResult } of modelResults) {
      allResults.push(summaryResult);
      if (summaryJudgeResult) allResults.push(summaryJudgeResult);
      allResults.push(tagsResult);
      if (tagsJudgeResult) allResults.push(tagsJudgeResult);

      const summary = summaryResult.success
        ? (summaryResult.output as { summary: string }).summary
        : "(error)";
      const tags = tagsResult.success
        ? (tagsResult.output as { tags: string[] }).tags
        : [];
      const judgePass = summaryJudgeResult?.success
        ? (summaryJudgeResult.output as { passed: boolean }).passed
        : null;
      const tagsJudgePass = tagsJudgeResult?.success
        ? (tagsJudgeResult.output as { passed: boolean }).passed
        : null;

      console.log(`  [${modelId}]`);
      console.log(`    Summary (${summaryResult.latencyMs.toFixed(0)}ms): ${summary}`);
      console.log(`    Summary judge: ${judgePass === null ? "skipped" : judgePass ? "PASS" : "FAIL"} (${summaryJudgeResult?.latencyMs.toFixed(0) ?? "-"}ms)`);
      console.log(`    Tags (${tagsResult.latencyMs.toFixed(0)}ms): [${tags.join(", ")}]`);
      console.log(`    Tags judge: ${tagsJudgePass === null ? "skipped" : tagsJudgePass ? "PASS" : "FAIL"} (${tagsJudgeResult?.latencyMs.toFixed(0) ?? "-"}ms)`);
    }
  }

  // ---------------------------------------------------------------------------
  // Aggregate report
  // ---------------------------------------------------------------------------
  console.log("\n\n========================================");
  console.log("        AGGREGATE RESULTS");
  console.log("========================================\n");

  for (const modelId of MODELS) {
    const modelResults2 = allResults.filter((r) => r.model === modelId);
    const successful = modelResults2.filter((r) => r.success);

    const byTask = (task: string) => successful.filter((r) => r.task === task);

    const summaryGen = byTask("summary-gen");
    const summaryJudge = byTask("summary-judge");
    const tagsGen = byTask("tags-gen");
    const tagsJudge = byTask("tags-judge");

    const avgLatency = (results: TaskResult[]) =>
      results.length > 0
        ? results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
        : 0;

    const totalCost = successful.reduce((sum, r) => sum + r.costUsd, 0);
    const totalInput = successful.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutput = successful.reduce((sum, r) => sum + r.outputTokens, 0);

    const summaryPassRate = summaryJudge.length > 0
      ? summaryJudge.filter((r) => (r.output as { passed: boolean })?.passed).length / summaryJudge.length
      : 0;
    const tagsPassRate = tagsJudge.length > 0
      ? tagsJudge.filter((r) => (r.output as { passed: boolean })?.passed).length / tagsJudge.length
      : 0;

    const errorCount = modelResults2.filter((r) => !r.success).length;

    console.log(`### ${modelId} ###`);
    console.log(`  Pricing: $${PRICING[modelId].input}/1M input, $${PRICING[modelId].output}/1M output`);
    console.log(`  Avg Latency:`);
    console.log(`    Summary gen:   ${avgLatency(summaryGen).toFixed(0)}ms`);
    console.log(`    Summary judge: ${avgLatency(summaryJudge).toFixed(0)}ms`);
    console.log(`    Tags gen:      ${avgLatency(tagsGen).toFixed(0)}ms`);
    console.log(`    Tags judge:    ${avgLatency(tagsJudge).toFixed(0)}ms`);
    console.log(`  Quality:`);
    console.log(`    Summary pass rate: ${(summaryPassRate * 100).toFixed(0)}% (${summaryJudge.filter((r) => (r.output as { passed: boolean })?.passed).length}/${summaryJudge.length})`);
    console.log(`    Tags pass rate:    ${(tagsPassRate * 100).toFixed(0)}% (${tagsJudge.filter((r) => (r.output as { passed: boolean })?.passed).length}/${tagsJudge.length})`);
    console.log(`  Tokens: ${totalInput} input, ${totalOutput} output`);
    console.log(`  Total cost: $${totalCost.toFixed(6)}`);
    console.log(`  Errors: ${errorCount}`);

    // Estimate per-bookmark cost (1 summary gen + 1 judge + 1 tags gen + 1 judge)
    const perBookmarkCost =
      summaryGen.length > 0 && tagsGen.length > 0
        ? totalCost / TEST_CASES.length
        : 0;
    console.log(`  Est. cost per bookmark: $${perBookmarkCost.toFixed(6)}`);
    console.log();
  }

  // ---------------------------------------------------------------------------
  // Comparison table
  // ---------------------------------------------------------------------------
  console.log("========================================");
  console.log("        COMPARISON TABLE");
  console.log("========================================\n");

  const header = ["Metric", ...MODELS];
  const rows: string[][] = [];

  for (const task of ["summary-gen", "summary-judge", "tags-gen", "tags-judge"] as const) {
    const latencies = MODELS.map((m) => {
      const results = allResults.filter((r) => r.model === m && r.task === task && r.success);
      return results.length > 0
        ? `${(results.reduce((s, r) => s + r.latencyMs, 0) / results.length).toFixed(0)}ms`
        : "N/A";
    });
    rows.push([`${task} latency`, ...latencies]);
  }

  // Quality rows
  for (const task of ["summary-judge", "tags-judge"] as const) {
    const rates = MODELS.map((m) => {
      const results = allResults.filter((r) => r.model === m && r.task === task && r.success);
      if (results.length === 0) return "N/A";
      const passed = results.filter((r) => (r.output as { passed: boolean })?.passed).length;
      return `${((passed / results.length) * 100).toFixed(0)}%`;
    });
    rows.push([`${task.replace("-judge", "")} pass%`, ...rates]);
  }

  // Cost per bookmark
  rows.push([
    "cost/bookmark",
    ...MODELS.map((m) => {
      const results = allResults.filter((r) => r.model === m && r.success);
      const cost = results.reduce((s, r) => s + r.costUsd, 0) / TEST_CASES.length;
      return `$${cost.toFixed(6)}`;
    }),
  ]);

  // Print table
  const colWidths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const sep = colWidths.map((w) => "-".repeat(w + 2)).join("+");
  console.log(header.map((h, i) => ` ${h.padEnd(colWidths[i])} `).join("|"));
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((c, i) => ` ${c.padEnd(colWidths[i])} `).join("|"));
  }

  console.log("\n\nDone.");
}

main().catch(console.error);
