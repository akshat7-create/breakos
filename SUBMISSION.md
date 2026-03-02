## What Changes, What AI Does, Where It Stops, and What Breaks First

### What the Human Can Now Do That They Couldn't Before

Before BreakOS, reconciliation analysts across any team - trade ops, payments, transfers, or treasury - start every cycle the same way: pull records from multiple systems, line them up in a spreadsheet, and manually scan for discrepancies. A single session can surface dozens of breaks across cash positions, settlements, or transaction records. Investigating each means toggling between systems, cross-referencing data, and writing up findings. At Wealthsimple's scale, reconciliation volume grows with every new product and banking partner.

With BreakOS, an analyst can load a full session and have every break surfaced, triaged by severity, and queued for review in seconds. They can click into any break and get an AI-generated investigation that cross-references transaction data, counterparty records, and historical patterns to deliver a root cause classification - something that previously required senior-level judgment. Most critically, Pattern Intelligence surfaces systemic issues across sessions that no human could catch from daily spreadsheets - like a counterparty consistently mismatching settlement dates, or a recurring variance tied to a specific product type. The analyst shifts from reactive to proactive, acting on intelligence instead of hunting through rows.

### What AI Is Responsible For

AI handles three core functions. First, automated triage - classifying every break by type, severity, and likely cause so the analyst sees a prioritized queue rather than a flat list. Second, deep investigation on individual breaks, cross-referencing internal records against external data to produce a structured root cause analysis. Third, Pattern Intelligence analyzes break history across sessions to detect recurring clusters pointing to upstream process failures rather than one-off discrepancies. The AI also generates investigation reports and dispatches alerts to stakeholders across ops, compliance, risk, and audit.

### Where AI Must Stop

AI does not resolve breaks. It investigates, classifies, and recommends, but a human must approve every resolution. BreakOS will never autonomously adjust a record, modify a transaction, or send a correction to a counterparty. Regulatory and operational accountability sits with people, not software. The AI cannot override compliance-set tolerance thresholds, cannot access data beyond what is loaded into a session, and cannot make judgment calls on materiality. Pattern Intelligence flags root causes but does not implement process changes. The human decides what to act on.

### What Would Break First at Scale

The investigation queue. If BreakOS scales from a single team to firm-wide deployment across trade ops, payments, transfers, treasury, and crypto, the AI investigation pipeline bottlenecks first. Each investigation requires an LLM call that cross-references contextual data - at hundreds of concurrent breaks across dozens of sessions, API latency and token costs compound quickly. Pattern detection also strains as the dataset grows: more sessions mean more combinatorial analysis to surface meaningful patterns without flooding analysts with false positives. The mitigation path is batched investigation with priority queuing, cached pattern models updating incrementally, and configurable confidence thresholds.
