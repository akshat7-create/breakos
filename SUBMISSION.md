# BreakOS — Submission Notes

## What the human can now do that they couldn't before

Before BreakOS, a reconciliation analyst received a break report and spent most of their morning doing research: pulling live prices, checking if a corporate action explains a quantity mismatch, computing bond accruals by hand, and drafting the same escalation emails for the hundredth time. That is hours of high-effort, low-judgment work.

With BreakOS, the analyst can triage a full morning queue in seconds and deep-dive into any break with a full AI-generated investigation already in front of them — live data fetched, root cause hypothesized, draft comms ready, routing recommended. The analyst's job shifts from researcher to decision-maker. They spend their time on the 5% of breaks that genuinely require human judgment, not the 95% where the answer is obvious once the data is assembled.

## What AI is responsible for

The AI owns the research layer entirely: fetching and interpreting live market data, detecting corporate action signals, calculating accruals, classifying break type and severity, generating ranked hypotheses with explicit confidence scores, and drafting counterparty communications. It surfaces everything a skilled analyst would gather — faster, and without fatigue or inconsistency across a large queue.

## Where AI must stop

AI must stop before the decision. It cannot approve its own escalation recommendations. A material break affecting client positions sits under regulatory audit requirements — there must be a named human who reviewed the reasoning and made the call. BreakOS enforces this with the Human Gate: the analyst sees the full AI reasoning chain, then explicitly approves or overrides, and that decision is logged immutably with a timestamp and notes. The AI's job is to make that decision cheap and well-informed, not to make it autonomously.

## What would break first at scale

The bottleneck at scale is the LLM call per break. The current architecture runs one streaming Claude call per investigation, which is fine for a queue of 30–50 breaks but becomes expensive and slow at 500+. The quick triage batch endpoint mitigates this for classification, but deep investigations don't parallelize cheaply. The second failure point is the in-memory session store — the backend holds all break state in a Python dict, which resets on restart and doesn't support multiple simultaneous users. At real production scale you'd need a persistent store and a job queue in front of the LLM calls.

---

## About

**Salary expectation:** $70,000 – $80,000 CAD

**Hands-on experience with AI tools and systems:** ~1 year through co-op rotations at Scotiabank, where I built internal tools to automate workflow-level tasks and help my team reduce redundant manual work. This included building agentic pipelines using Claude, working with MCP tools, and using Antigravity for rapid UI iteration — all focused on practical, deployed tooling rather than research.
