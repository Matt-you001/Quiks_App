function scoreSummary(report) {
  const rows = (Array.isArray(report?.rows) ? report.rows : []).map((row) => ({
    subject: String(row.subject ?? ""),
    activity: String(row.activity ?? row.title ?? ""),
    type: String(row.type ?? ""),
    score: Number(row.score ?? row.adjustedScore ?? 0),
  }));
  const strongest = [...rows].sort((left, right) => right.score - left.score).slice(0, 3);
  const developing = [...rows].sort((left, right) => left.score - right.score).slice(0, 3);
  return {
    average: Number(report?.average ?? 0),
    assessmentCount: rows.length,
    results: rows.slice(0, 100),
    strongest,
    developing,
  };
}

function fallbackComment(report) {
  const summary = scoreSummary(report);
  const average = summary.average;
  const opening = average >= 80
    ? "The student has demonstrated excellent overall achievement"
    : average >= 65
      ? "The student has demonstrated good overall progress"
      : average >= 50
        ? "The student has made satisfactory progress"
        : "The student is developing foundational understanding and would benefit from additional support";
  const strongest = summary.strongest[0]?.subject;
  const developing = summary.developing[0]?.subject;
  const strengthText = strongest ? `, with a notable strength in ${strongest}` : "";
  const supportText = developing && developing !== strongest
    ? ` Continued practice and teacher-guided revision in ${developing} should support further improvement.`
    : " Consistent revision and participation should support continued improvement.";
  return `${opening}${strengthText}.${supportText}`;
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const texts = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content.text === "string") texts.push(content.text);
    }
  }
  return texts.join("\n").trim();
}

export async function draftSchoolReportComment(report, fetcher = fetch) {
  const fallback = fallbackComment(report);
  const apiKey = String(process.env.OPENAI_API_KEY ?? "").trim();
  const model = String(process.env.OPENAI_MODEL ?? "gpt-4.1-mini").trim();
  if (!apiKey) return { comment: fallback, generatedBy: "fallback" };

  const summary = scoreSummary(report);
  try {
    const response = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        store: false,
        instructions: [
          "Write one concise class teacher's comment for a student academic report.",
          "Base it only on the supplied scores. Mention a genuine strength and a constructive next step where the data supports them.",
          "Use a warm, professional school tone. Do not diagnose, label personality, infer protected or sensitive traits, or mention AI.",
          "Do not include the student's name, rankings, invented facts, salutations, headings, signatures, markdown, or quotation marks.",
          "Use 45 to 80 words in one paragraph.",
        ].join(" "),
        input: JSON.stringify(summary),
      }),
    });
    if (!response.ok) return { comment: fallback, generatedBy: "fallback" };
    const comment = extractOutputText(await response.json()).replace(/^['"]|['"]$/g, "").trim().slice(0, 2000);
    return comment ? { comment, generatedBy: "ai" } : { comment: fallback, generatedBy: "fallback" };
  } catch {
    return { comment: fallback, generatedBy: "fallback" };
  }
}
