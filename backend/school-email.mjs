const resendApiKey = String(process.env.RESEND_API_KEY ?? "").trim();
const invitationFrom = String(process.env.QUIKS_SCHOOL_EMAIL_FROM ?? "").trim();
const enrolmentUrl = String(process.env.QUIKS_SCHOOL_ENROLMENT_URL ?? "https://quiks.site/school-enrol.html").trim();

export function getSchoolEmailDiagnostics() {
  return {
    provider: "resend",
    configured: Boolean(resendApiKey && invitationFrom),
    fromConfigured: Boolean(invitationFrom),
  };
}

export async function sendSchoolResultEmail(report, fetcher = fetch) {
  if (!resendApiKey || !invitationFrom) return { status: "not_configured" };
  const lines = [report.schoolName, report.title, `Student: ${report.studentName}`, "",
    ...report.rows.flatMap((row) => [
      `${row.subject} | ${row.className} | ${row.title} (${row.type})`,
      `Report mark: ${row.adjustedScore ?? row.score}% | Attempt: ${row.attemptNumber}`,
      ...(row.adjustmentReason ? [`Original mark: ${row.score}% | Reviewed adjustment: ${row.adjustmentReason}`] : []), "",
    ]), `Average: ${report.average}%`, report.calculation, "",
    `Administrator's comment: ${report.comment || "No additional comment."}`,
    "", "Marks have been reviewed for this report by the school. Contact the school with any questions."];
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json", "Idempotency-Key": report.delivery.key },
      body: JSON.stringify({ from: invitationFrom, to: [report.email], subject: `${report.schoolName}: ${report.title}`.replace(/[\r\n]/g, " "), text: lines.join("\n") }),
    });
    if (!response.ok) return { status: response.status >= 500 ? "unknown" : "failed" };
    const payload = await response.json();
    return typeof payload.id === "string" ? { status: "sent", messageId: payload.id } : { status: "unknown" };
  } catch { return { status: "unknown" }; }
}

export async function sendSchoolInvitationEmail({ email, schoolName, invitationCode, role, expiresAt }) {
  if (!resendApiKey || !invitationFrom) {
    return { status: "not_configured" };
  }

  const link = new URL(enrolmentUrl);
  link.searchParams.set("code", invitationCode);
  const roleLabel = role === "school_admin" ? "school administrator" : role;
  const expiryLabel = new Date(expiresAt).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `quiks-school-invite-${invitationCode}`,
      "User-Agent": "Quiks-School/1.0",
    },
    body: JSON.stringify({
      from: invitationFrom,
      to: [email],
      subject: `${schoolName} invited you to Quiks School`,
      text: [
        `You have been invited to join ${schoolName} as a ${roleLabel}.`,
        "",
        `Your individual invitation code is: ${invitationCode}`,
        `Use it before ${expiryLabel}.`,
        "",
        `Open Quiks School enrolment: ${link.toString()}`,
        "Sign in with this same email address before using the code.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    const providerMessage = (await response.text()).slice(0, 500);
    console.error(`School invitation email failed (${response.status}): ${providerMessage}`);
    return { status: "failed" };
  }

  const result = await response.json().catch(() => ({}));
  return { status: "sent", messageId: typeof result.id === "string" ? result.id : undefined };
}
