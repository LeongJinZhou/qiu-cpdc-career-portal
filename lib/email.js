// Email delivery seam for supervisor magic links (Module 4).
//
// Production plugs in a real provider by setting RESEND_API_KEY (and optionally
// EMAIL_FROM). With no key configured — the prototype default — delivery
// gracefully degrades: nothing is sent, and the caller receives the approval
// URL back so the UI can still surface a copyable link. The raw link is never
// logged, matching the discipline in the magic-link route.

const DEFAULT_FROM = 'CPDC <no-reply@cpdc.qiu.edu.my>';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function isEmailConfigured(env = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim());
}

export function buildSupervisorApprovalEmail({ supervisorName, studentName, entryTitle, approvalUrl }) {
  const safeSupervisor = escapeHtml(supervisorName || 'there');
  const safeStudent = escapeHtml(studentName || 'A student');
  const safeTitle = entryTitle ? ` &ldquo;${escapeHtml(entryTitle)}&rdquo;` : '';
  const safeUrl = escapeHtml(approvalUrl);

  return `
    <p>Hello ${safeSupervisor},</p>
    <p>${safeStudent} has requested your sign-off on their fieldwork
    logbook entry${safeTitle}.</p>
    <p><a href="${safeUrl}">Review and approve the entry</a></p>
    <p>This is a one-time secure link. If you didn't expect it, you can ignore this email.</p>
  `;
}

/**
 * Send the supervisor their tokenized approval link.
 *
 * @returns {Promise<{ delivered: boolean, reason?: string }>}
 */
export async function sendSupervisorApprovalEmail(
  { to, supervisorName, studentName, entryTitle, approvalUrl },
  env = process.env,
) {
  if (!to) {
    return { delivered: false, reason: 'no-recipient' };
  }

  if (!isEmailConfigured(env)) {
    // No provider wired up: the route returns approvalUrl to the client instead.
    return { delivered: false, reason: 'provider-not-configured' };
  }

  const subject = `Approve ${studentName ?? 'a student'}'s logbook entry`;
  const html = buildSupervisorApprovalEmail({
    supervisorName,
    studentName,
    entryTitle,
    approvalUrl,
  });

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM?.trim() || DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      return { delivered: false, reason: `provider-error-${res.status}` };
    }
    return { delivered: true };
  } catch {
    return { delivered: false, reason: 'provider-unreachable' };
  }
}
