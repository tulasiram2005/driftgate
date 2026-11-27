# Five-minute hosted demo

Use an account with access to the Threadline Demo project to show private QA evidence. The storefront is public. Its checkout simulates an order with fictional products and prices.

1. **0:00–0:40 — Open Threadline.** Browse the six products on staging. Open the Everyday T-Shirt and select size M. [Clean storefront](https://driftgate-threadline.vercel.app/staging)
2. **0:40–1:30 — Reproduce the defect.** On UAT, compare the ₹44.99 product price with the ₹39.99 unit price in the cart quote. Staging displays and quotes ₹39.99. [UAT shirt](https://driftgate-threadline.vercel.app/uat/products/everyday-shirt)
3. **1:30–2:30 — Inspect a completed automated run.** Open Threadline Demo in DriftGate, select Automated runs, and open the staging Chromium desktop run. Inspect the result and its screenshot or trace. The worker dispatches a GitHub Actions job against an isolated copy of Threadline. Use a completed run during a live presentation to avoid waiting on CI. [QA workspace](https://driftgate-web.vercel.app)
4. **2:30–3:20 — Follow the failed test.** Open the UAT manual result for the shirt-price check. Its reproduction notes preserve both prices. Open the associated defect and its linked verification issue. [Jira issue KAN-2](https://ramtulasi062005.atlassian.net/browse/KAN-2)
5. **3:20–4:10 — Review database evidence.** In SQL checks, select each environment. Show the recorded assertion results and violation counts. Discuss why those passing data checks can coexist with a storefront price discrepancy.
6. **4:10–5:00 — Review release readiness.** Open Threadline QA demo under Releases. Inspect the staging gate and its unmet criteria, then export the PDF. A blocked gate is the expected outcome for this demo release. A named approver can sign off once the evidence meets the gate criteria.

The free API service can take time to wake up. Open the workspace before presenting. Jira and private project evidence require the appropriate account access.
