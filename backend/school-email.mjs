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
