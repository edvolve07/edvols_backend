import PDFDocument from "pdfkit";

// ── Palette & Typography ─────────────────────────────────────────────
const COLORS = {
  primary: "#059669",      // Emerald
  primaryDark: "#065f46",
  primaryLight: "#ecfdf5",
  primaryBorder: "#a7f3d0",
  slateDark: "#0f172a",    // Main titles
  slateText: "#334155",    // Body text
  slateMuted: "#64748b",   // Secondary / labels
  slateLight: "#f8fafc",   // Card background
  border: "#e2e8f0",       // Dividers / borders
  amber: "#d97706",
  amberLight: "#fffbeb",
  red: "#dc2626",
  redLight: "#fef2f2",
  white: "#ffffff",
};

const METRIC_LABELS = {
  communication: "Communication Skills",
  confidence: "Confidence",
  body_language: "Body Language",
  knowledge: "Technical Knowledge",
  fluency: "Fluency & Delivery",
  skill_relevance: "Skill Relevance",
  clarity: "Clarity & Articulation",
  structure: "Structure & Flow",
  conciseness: "Conciseness",
  relevance: "Relevance to Question",
  confidence_tone: "Confidence & Tone",
};

function scoreColor(val, max = 10) {
  const pct = max === 10 ? val * 10 : (val / max) * 100;
  if (pct >= 75) return COLORS.primary;
  if (pct >= 50) return COLORS.amber;
  return COLORS.red;
}

// ── Page & Flow Helpers ──────────────────────────────────────────────
function checkPageBreak(doc, neededHeight = 60) {
  if (doc.y + neededHeight > doc.page.height - 50) {
    doc.addPage();
    return true;
  }
  return false;
}

function drawHeaderBanner(doc, title, subtitle = "") {
  checkPageBreak(doc, 70);
  const startY = doc.y;

  doc.roundedRect(40, startY, 520, 60, 8).fill(COLORS.primary);

  doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.white)
    .text(title, 56, startY + 12, { width: 488 });

  if (subtitle) {
    doc.font("Helvetica").fontSize(9.5).fillColor("#d1fae5")
      .text(subtitle, 56, startY + 36, { width: 488 });
  }

  doc.y = startY + 70;
}

function drawDetailsCard(doc, details = []) {
  checkPageBreak(doc, 50);
  const cardY = doc.y;
  const colWidth = 173;
  const rowHeight = 28;
  const rows = Math.ceil(details.length / 3);
  const cardHeight = rows * rowHeight + 10;

  doc.roundedRect(40, cardY, 520, cardHeight, 6).fillAndStroke(COLORS.slateLight, COLORS.border);

  let idx = 0;
  for (const item of details) {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const itemX = 52 + col * colWidth;
    const itemY = cardY + 8 + row * rowHeight;

    doc.font("Helvetica").fontSize(8).fillColor(COLORS.slateMuted)
      .text(item.label.toUpperCase(), itemX, itemY, { width: colWidth - 10 });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.slateDark)
      .text(String(item.value || "—"), itemX, itemY + 11, { width: colWidth - 10, ellipsis: true });

    idx++;
  }

  doc.y = cardY + cardHeight + 12;
}

function drawOverallBanner(doc, overall = {}) {
  checkPageBreak(doc, 75);
  const y = doc.y;
  const grade = overall.grade || "B";
  const percentage = Math.round(overall.percentage || 0);
  const label = overall.grade_label || "Completed";
  const total = overall.total_score != null ? overall.total_score : 0;
  const max = overall.max_score || 100;

  // Banner background
  doc.roundedRect(40, y, 520, 68, 8)
    .fillAndStroke(COLORS.primaryLight, COLORS.primaryBorder);

  // Grade badge
  doc.roundedRect(54, y + 10, 48, 48, 8).fill(COLORS.primary);
  doc.font("Helvetica-Bold").fontSize(24).fillColor(COLORS.white)
    .text(grade, 54, y + 21, { width: 48, align: "center" });

  // Main text
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.primaryDark)
    .text(`${label} Performance`, 116, y + 14);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.slateText)
    .text(`Overall Score: ${percentage}%  (${total} / ${max} points)`, 116, y + 34);

  // Status pill on right
  doc.roundedRect(440, y + 20, 105, 26, 13).fill(COLORS.white);
  doc.roundedRect(440, y + 20, 105, 26, 13).strokeColor(COLORS.primaryBorder).lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.primary)
    .text(`${percentage}% SCORE`, 440, y + 27, { width: 105, align: "center" });

  doc.y = y + 80;
}

function drawMetricsGrid(doc, metrics = {}) {
  const entries = Object.entries(metrics).filter(([_, v]) => v != null);
  if (!entries.length) return;

  checkPageBreak(doc, 100);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.slateDark).text("Core Dimension Scores");
  doc.moveDown(0.4);

  const startY = doc.y;
  const count = entries.length;
  const colWidth = (520 - (count - 1) * 8) / count;

  entries.forEach(([key, value], idx) => {
    const num = Number(value) || 0;
    const boxX = 40 + idx * (colWidth + 8);
    const boxY = startY;

    doc.roundedRect(boxX, boxY, colWidth, 54, 6).fillAndStroke(COLORS.slateLight, COLORS.border);

    doc.font("Helvetica-Bold").fontSize(13).fillColor(scoreColor(num, 10))
      .text(`${num.toFixed(1)}/10`, boxX, boxY + 7, { width: colWidth, align: "center" });
    doc.font("Helvetica").fontSize(7).fillColor(COLORS.slateMuted)
      .text(METRIC_LABELS[key] || key.replace(/_/g, " "), boxX + 3, boxY + 24, { width: colWidth - 6, align: "center", maxLines: 2 });

    // Dynamic mini progress bar
    const barW = Math.max(10, colWidth - 14);
    const fillW = Math.max(2, barW * (Math.min(10, Math.max(0, num)) / 10));
    doc.roundedRect(boxX + 7, boxY + 44, barW, 3, 1.5).fill(COLORS.border);
    doc.roundedRect(boxX + 7, boxY + 44, fillW, 3, 1.5).fill(scoreColor(num, 10));
  });

  doc.y = startY + 66;
}

function drawBulletSection(doc, title, items = [], iconColor = COLORS.primary) {
  if (!items || !items.length) return;
  checkPageBreak(doc, 45);

  doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.slateDark).text(title);
  doc.moveDown(0.4);

  for (const item of items) {
    if (!item) continue;
    checkPageBreak(doc, 25);
    const itemY = doc.y;

    // Bullet dot
    doc.circle(46, itemY + 5, 2.5).fill(iconColor);
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.slateText)
      .text(String(item).trim(), 56, itemY, { width: 504, lineGap: 2 });
    doc.moveDown(0.3);
  }
  doc.moveDown(0.5);
}

function drawFooters(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;

  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 30;

    doc.moveTo(40, footerY - 8).lineTo(560, footerY - 8).strokeColor(COLORS.border).lineWidth(0.5).stroke();

    doc.font("Helvetica").fontSize(8).fillColor(COLORS.slateMuted)
      .text("EdVols AI Coaching Platform · Confidential Evaluation Report", 40, footerY, { width: 350 });

    doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.slateMuted)
      .text(`Page ${i + 1} of ${total}`, 450, footerY, { width: 110, align: "right" });
  }
}

// ── 1. Mock Interview Performance Report PDF ─────────────────────────
export function generatePerformancePdf(report) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, autoFirstPage: true, bufferPages: true });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const role = report.interview_role || report.role || "General Role";
    const domain = report.interview_domain || report.domain || "AI Mock Interview";

    drawHeaderBanner(
      doc,
      "Interview Performance Report",
      `Comprehensive AI-Assisted Mock Interview Analysis & Feedback`
    );

    drawDetailsCard(doc, [
      { label: "Candidate", value: report.student_name || "Candidate" },
      { label: "Target Role", value: role },
      { label: "Domain", value: domain },
      { label: "Report ID", value: report.report_id || "N/A" },
      { label: "Date", value: report.generated_date || new Date().toLocaleDateString() },
      { label: "Email", value: report.student_email || "—" },
    ]);

    drawOverallBanner(doc, report.overall || {});
    drawMetricsGrid(doc, report.overall?.metrics || {});

    // Strengths & Improvements
    drawBulletSection(doc, "Key Strengths", report.strengths || [], COLORS.primary);
    drawBulletSection(doc, "Areas for Improvement", report.areas_to_improve || report.improvements || [], COLORS.amber);
    drawBulletSection(doc, "Actionable Interview Tips", report.interview_tips || [], COLORS.primary);

    // Question-wise Performance
    const questions = Array.isArray(report.question_breakdown) ? report.question_breakdown : [];
    if (questions.length > 0) {
      checkPageBreak(doc, 80);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.slateDark).text("Question-by-Question Breakdown");
      doc.moveDown(0.5);

      questions.forEach((item, index) => {
        const ev = item.evaluation || item.scores || {};
        checkPageBreak(doc, 100);

        const cardTop = doc.y;
        doc.roundedRect(40, cardTop, 520, 24, 4).fill(COLORS.slateLight);
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.primary)
          .text(`Question ${item.question_number || item.number || index + 1}`, 48, cardTop + 7);

        doc.y = cardTop + 30;
        doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.slateDark)
          .text(item.question || "Question prompt", 48, doc.y, { width: 504 });
        doc.moveDown(0.4);

        if (item.answer && item.answer !== "Not Answered") {
          const ansText = typeof item.answer === "string"
            ? item.answer
            : Array.isArray(item.answer) ? item.answer.join(" ") : String(item.answer);

          doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(COLORS.slateMuted)
            .text(`Candidate Answer: "${ansText}"`, 48, doc.y, { width: 504 });
          doc.moveDown(0.4);
        }

        // Scores line
        const scoresLine = [
          `Confidence: ${ev.confidence ?? "—"}/10`,
          `Body Language: ${ev.body_language ?? "—"}/10`,
          `Knowledge: ${ev.knowledge ?? "—"}/10`,
          `Fluency: ${ev.fluency ?? "—"}/10`,
          `Skill Relevance: ${ev.skill_relevance ?? "—"}/10`,
        ].join("   •   ");

        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primaryDark).text(scoresLine, 48, doc.y);
        doc.moveDown(0.4);

        // Feedback
        if (ev.feedback) {
          doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slateText)
            .text(`Coach Feedback: ${ev.feedback}`, 48, doc.y, { width: 504, lineGap: 2 });
          doc.moveDown(0.4);
        }

        if (Array.isArray(ev.strengths) && ev.strengths.length) {
          doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primary).text("Strengths:", 48, doc.y);
          ev.strengths.forEach((s) => {
            doc.font("Helvetica").fontSize(8).fillColor(COLORS.slateText).text(`+ ${s}`, 56, doc.y);
          });
          doc.moveDown(0.3);
        }

        if (Array.isArray(ev.improvements) && ev.improvements.length) {
          doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.amber).text("Improvements:", 48, doc.y);
          ev.improvements.forEach((imp) => {
            doc.font("Helvetica").fontSize(8).fillColor(COLORS.slateText).text(`- ${imp}`, 56, doc.y);
          });
          doc.moveDown(0.3);
        }

        doc.moveTo(40, doc.y + 4).lineTo(560, doc.y + 4).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.moveDown(0.8);
      });
    }

    drawFooters(doc);
    doc.end();
  });
}

// ── 2. ATS Resume Match Candidate Report PDF ────────────────────────
export function generateAtsPdf(report) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, autoFirstPage: true, bufferPages: true });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const ats = report.ats_analysis || {};
    const atsScore = Number(ats.ats_score) || 0;
    const role = report.interview_role || report.role || "Target Role";

    drawHeaderBanner(
      doc,
      "ATS Candidate Evaluation Report",
      "Applicant Tracking System Resume Match & Key Keyword Audit"
    );

    drawDetailsCard(doc, [
      { label: "Candidate", value: report.student_name || "Candidate" },
      { label: "Target Role", value: role },
      { label: "ATS Score", value: `${atsScore} / 100` },
      { label: "Report ID", value: report.report_id || "N/A" },
      { label: "Date", value: report.generated_date || new Date().toLocaleDateString() },
      { label: "Email", value: report.student_email || "—" },
    ]);

    // ATS Score Card
    checkPageBreak(doc, 75);
    const y = doc.y;
    doc.roundedRect(40, y, 520, 68, 8).fillAndStroke(COLORS.slateLight, COLORS.border);

    // Score badge
    const badgeColor = scoreColor(atsScore, 100);
    doc.roundedRect(54, y + 10, 48, 48, 8).fill(badgeColor);
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.white)
      .text(`${atsScore}`, 54, y + 23, { width: 48, align: "center" });

    doc.font("Helvetica-Bold").fontSize(14).fillColor(COLORS.slateDark)
      .text("ATS Resume Match Rating", 116, y + 14);
    doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.slateText)
      .text(
        atsScore >= 75
          ? "Strong alignment with target role job requirements and technical keywords."
          : atsScore >= 50
          ? "Moderate keyword match. Recommended resume refinements detailed below."
          : "Low alignment. Critical skills and formatting need immediate enhancement.",
        116,
        y + 32,
        { width: 420 }
      );

    doc.y = y + 80;

    // Skills Found Section
    const skills = Array.isArray(ats.skills_found) ? ats.skills_found : [];
    if (skills.length > 0) {
      checkPageBreak(doc, 60);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.slateDark).text("Identified Skills & Keywords");
      doc.moveDown(0.4);

      // Render skill pills
      let currX = 40;
      let currY = doc.y;

      skills.forEach((skill) => {
        const pillWidth = doc.font("Helvetica-Bold").fontSize(8).widthOfString(skill) + 14;
        if (currX + pillWidth > 560) {
          currX = 40;
          currY += 22;
          checkPageBreak(doc, 30);
        }

        doc.roundedRect(currX, currY, pillWidth, 18, 4).fill(COLORS.primaryLight);
        doc.roundedRect(currX, currY, pillWidth, 18, 4).strokeColor(COLORS.primaryBorder).lineWidth(0.5).stroke();
        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primaryDark)
          .text(skill, currX + 7, currY + 5);

        currX += pillWidth + 6;
      });

      doc.y = currY + 28;
    }

    // ATS Improvements
    drawBulletSection(doc, "Recommended Resume Improvements", ats.improvements || [], COLORS.amber);

    // Strengths from interview
    drawBulletSection(doc, "Demonstrated Role Competencies", report.strengths || [], COLORS.primary);
    drawBulletSection(doc, "Interview Action Plan", report.interview_tips || [], COLORS.primary);

    drawFooters(doc);
    doc.end();
  });
}

// ── 3. Communication Coaching Report PDF ────────────────────────────
export function generateCommunicationPdf(report, session = {}) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, autoFirstPage: true, bufferPages: true });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const summary = report.session_summary || {};
    const category = report.category || summary.scenario || "Communication Practice";
    const mode = summary.communication_mode || session.context || "General";
    const duration = summary.duration ? `${Math.round(summary.duration / 60)} min` : "Completed";

    drawHeaderBanner(
      doc,
      "Communication Coaching Report",
      "AI-Powered Conversation Practice, Voice Analysis & Improvement Plan"
    );

    drawDetailsCard(doc, [
      { label: "Student", value: report.student_name || "Student" },
      { label: "Practice Mode", value: mode },
      { label: "Scenario", value: category },
      { label: "Session ID", value: report.session_id || "N/A" },
      { label: "Turns", value: `${summary.total_turns || report.exchange_breakdown?.length || 0} exchanges` },
      { label: "Duration", value: duration },
    ]);

    drawOverallBanner(doc, report.overall || {
      grade: summary.performance_level === "Excellent" ? "A" : summary.performance_level === "Advanced" ? "B" : "C",
      percentage: summary.overall_communication_score || report.overall?.percentage || 0,
      grade_label: summary.performance_level || report.overall?.grade_label || "Completed",
      total_score: report.overall?.total_score,
      max_score: report.overall?.max_score,
    });

    // Communication Dimensions
    const commMetrics = report.overall?.metrics || {};
    drawMetricsGrid(doc, commMetrics);

    // Overall Coaching Feedback
    if (report.overall_feedback) {
      checkPageBreak(doc, 70);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.slateDark).text("AI Coach Overall Feedback");
      doc.moveDown(0.4);

      const y = doc.y;
      const textHeight = doc.font("Helvetica").fontSize(9.5).heightOfString(report.overall_feedback, { width: 500, lineGap: 2 });
      doc.roundedRect(40, y, 520, textHeight + 16, 6).fillAndStroke(COLORS.slateLight, COLORS.border);

      doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.slateText)
        .text(report.overall_feedback, 50, y + 8, { width: 500, lineGap: 2 });
      doc.y = y + textHeight + 24;
    }

    // Key Strengths & Areas to Improve
    drawBulletSection(doc, "Observed Strengths", report.strengths || [], COLORS.primary);
    drawBulletSection(doc, "Areas for Improvement", report.areas_to_improve || [], COLORS.amber);
    drawBulletSection(doc, "Coaching Tips & Best Practices", report.tips || [], COLORS.primary);
    drawBulletSection(doc, "Real-World Application Guidance", report.real_world_preparation || [], COLORS.primary);

    // Competency Analysis
    const comp = report.competency_analysis || {};
    if (comp.demonstrated_competencies?.length || comp.competencies_to_develop?.length || comp.communication_style) {
      checkPageBreak(doc, 80);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.slateDark).text("Competency & Communication Style");
      doc.moveDown(0.4);

      if (comp.communication_style) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.primaryDark).text("Communication Style: ", { continued: true });
        doc.font("Helvetica").fontSize(9).fillColor(COLORS.slateText).text(comp.communication_style);
        doc.moveDown(0.4);
      }

      if (comp.demonstrated_competencies?.length) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.primary).text("Demonstrated: ", { continued: true });
        doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slateText).text(comp.demonstrated_competencies.join(", "));
        doc.moveDown(0.3);
      }

      if (comp.competencies_to_develop?.length) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.amber).text("To Develop: ", { continued: true });
        doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slateText).text(comp.competencies_to_develop.join(", "));
        doc.moveDown(0.5);
      }
    }

    // Detailed Dialogue Breakdown
    const exchanges = Array.isArray(report.exchange_breakdown) ? report.exchange_breakdown : [];
    if (exchanges.length > 0) {
      checkPageBreak(doc, 80);
      doc.font("Helvetica-Bold").fontSize(13).fillColor(COLORS.slateDark).text("Exchange-by-Exchange Analysis");
      doc.moveDown(0.5);

      exchanges.forEach((ex, idx) => {
        checkPageBreak(doc, 100);

        const cardTop = doc.y;
        doc.roundedRect(40, cardTop, 520, 22, 4).fill(COLORS.slateLight);
        doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.primary)
          .text(`Exchange ${ex.number || idx + 1}`, 48, cardTop + 6);

        doc.y = cardTop + 28;

        // Coach Prompt
        if (ex.prompt) {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.primaryDark).text("Coach Prompt:", 48, doc.y);
          doc.font("Helvetica").fontSize(9).fillColor(COLORS.slateDark).text(ex.prompt, 48, doc.y, { width: 504 });
          doc.moveDown(0.3);
        }

        // Student Answer
        if (ex.answer) {
          const ans = typeof ex.answer === "string" ? ex.answer : Array.isArray(ex.answer) ? ex.answer.join(" ") : String(ex.answer);
          doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.slateMuted).text("Student Response:", 48, doc.y);
          doc.font("Helvetica-Oblique").fontSize(8.5).fillColor(COLORS.slateText).text(`"${ans}"`, 48, doc.y, { width: 504 });
          doc.moveDown(0.3);
        }

        // Evaluation scores line
        const ev = ex.evaluation || {};
        const scLine = [
          `Clarity: ${ev.clarity ?? "—"}/10`,
          `Structure: ${ev.structure ?? "—"}/10`,
          `Conciseness: ${ev.conciseness ?? "—"}/10`,
          `Relevance: ${ev.relevance ?? "—"}/10`,
          `Confidence: ${ev.confidence_tone ?? "—"}/10`,
        ].join("   •   ");

        doc.font("Helvetica-Bold").fontSize(8).fillColor(COLORS.primaryDark).text(scLine, 48, doc.y);
        doc.moveDown(0.3);

        // Feedback
        if (ex.feedback) {
          doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.slateText)
            .text(`Feedback: ${ex.feedback}`, 48, doc.y, { width: 504, lineGap: 2 });
          doc.moveDown(0.3);
        }

        doc.moveTo(40, doc.y + 4).lineTo(560, doc.y + 4).strokeColor(COLORS.border).lineWidth(0.5).stroke();
        doc.moveDown(0.7);
      });
    }

    drawFooters(doc);
    doc.end();
  });
}
