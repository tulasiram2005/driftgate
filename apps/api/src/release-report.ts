import PDFDocument from "pdfkit";
import type { collectApprovals } from "./release-signoffs.js";

export type ReportInput = {
  name: string;
  projectName: string;
  releaseId: string;
  generatedAt: Date;
  approvals: NonNullable<Awaited<ReturnType<typeof collectApprovals>>>;
  defects: { id: string; title: string; severity: string; status: string }[];
};

// Standard PDF fonts use Latin-1. Preserve other characters as explicit Unicode
// escapes instead of silently producing missing or misleading glyphs.
function printable(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (char === "\n") return char;
      return code >= 32 && code <= 126 ? char : `\\u{${code.toString(16)}}`;
    })
    .join("");
}

export async function renderReleaseReport(input: ReportInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, right: 48, bottom: 72, left: 48 },
    bufferPages: true,
    info: {
      Title: printable(input.name),
      Author: "DriftGate",
      Subject: "Release evidence and approval snapshot",
    },
  });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = 499;
  const ink = "#14171D";
  function line(text: string, size = 10, bold = false) {
    doc
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(size)
      .fillColor(ink);
    doc.text(printable(text), 48, doc.y, { width, lineGap: 4 });
    doc.moveDown(0.45);
  }
  function heading(text: string) {
    if (doc.y > 680) doc.addPage();
    doc.moveDown(0.6);
    line(text, 17, true);
  }
  function newSection(title: string) {
    doc.addPage();
    heading(title);
  }
  doc.rect(48, 48, width, 7).fill("#D5FF3F");
  doc.y = 73;
  line("DRIFTGATE / RELEASE REPORT", 11, true);
  line(input.name, 28, true);
  line(input.projectName, 14);
  line(`Generated ${input.generatedAt.toISOString()} (UTC)`);
  line(`Release ID: ${input.releaseId}`);
  heading("Decision snapshot");
  const approved = input.approvals.gates.every((gate) => gate.current);
  line(
    approved ? "All environment gates currently approved" : "Release is not fully approved",
    16,
    true,
  );
  line(
    "This report is a point-in-time record, not a new approval. Changes or expiry of evidence can invalidate the approvals shown here.",
  );
  for (const gate of input.approvals.gates) {
    line(
      `${gate.environment}: ${gate.current ? "CURRENT APPROVAL" : gate.signoff ? "STALE APPROVAL" : "NOT APPROVED"} | readiness ${gate.readiness?.score ?? "incomplete"}`,
      11,
      true,
    );
  }
  heading("Scope and exclusions");
  line(
    "MVP readiness weights: critical tests 40, defects 25, drift 15, visual review 10, accessibility 10. Threshold: 90. Hard blockers still apply.",
  );
  line(
    "Performance budgets, optional AI and notifications are excluded from the MVP. Evidence IDs identify stored sources; private files and expiring download URLs are not embedded.",
  );
  line(
    "Text outside ASCII is represented by explicit Unicode escapes to preserve exact values with portable PDF fonts.",
  );
  for (const gate of input.approvals.gates) {
    newSection(`${gate.environment} / evidence and decision`);
    const readiness = gate.readiness;
    line(
      `Approval: ${gate.current ? "current" : gate.signoff ? "stale" : "not recorded"}`,
      13,
      true,
    );
    if (!readiness) {
      line("Gate evidence unavailable");
      continue;
    }
    line(`Policy ${readiness.policyVersion} | assessed ${readiness.assessedAt}`);
    for (const part of readiness.components)
      line(
        `${part.name}: ${part.points ?? "incomplete"}/${part.weight}${part.reason ? ` - ${part.reason}` : ""}`,
      );
    line(`Blockers: ${readiness.blockers.join(", ") || "none"}`);
    line(`Source problems: ${readiness.sourceProblems.join(", ") || "none"}`);
    line(`Evidence hash: ${readiness.evidenceHash}`, 9);
    heading("Source references");
    for (const [name, source] of Object.entries(readiness.evidence)) {
      if (!source || typeof source !== "object" || !("sourceIds" in source)) continue;
      line(`${name} | observed ${source.observedAt}`, 10, true);
      for (const reference of source.sourceIds) line(reference, 9);
    }
    if (gate.signoff) {
      heading("Latest recorded approval");
      line(`${gate.signoff.approverName} (${gate.signoff.approverId})`);
      line(gate.signoff.createdAt.toISOString());
      line(gate.signoff.comment);
    }
  }
  newSection("Project defects");
  line(
    `${input.defects.length} project defects at export time. Includes all statuses, not only linked-run defects.`,
  );
  for (const defect of input.defects) {
    line(`${defect.severity} / ${defect.status} / ${defect.title}`, 11, true);
    line(defect.id, 9);
  }
  newSection("Approval audit trail");
  line(`Chain verification: ${input.approvals.verification.valid ? "VALID" : "FAILED"}`, 14, true);
  line(
    `${input.approvals.verification.count} records. First invalid sequence: ${input.approvals.verification.firstInvalidSequence ?? "none"}.`,
  );
  line(
    "Hashes detect modified records, order and count mismatches. They do not protect against an administrator rewriting the entire database. This PDF is not digitally signed.",
  );
  for (const record of input.approvals.records) {
    heading(`${record.sequence}. ${record.environment}`);
    line(`${record.approverName} (${record.approverId}) | ${record.createdAt.toISOString()}`);
    line(record.comment);
    line(`Evidence: ${record.evidenceHash}`, 9);
    line(`Previous record: ${record.previousHash ?? "genesis"}`, 9);
    line(`Record hash: ${record.hash}`, 9);
    line(`Preceding gate approval: ${record.precedingGateSignoffId ?? "none"}`, 9);
  }
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(index);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#525866")
      .text(`DriftGate | ${index + 1} / ${range.count}`, 48, 805, { width, lineBreak: false });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return finished;
}
