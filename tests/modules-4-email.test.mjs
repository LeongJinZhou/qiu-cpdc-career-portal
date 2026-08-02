import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSupervisorApprovalEmail, escapeHtml, isEmailConfigured } from '../lib/email.js';

test('supervisor email HTML escapes names, titles, and link attributes', () => {
  const html = buildSupervisorApprovalEmail({
    supervisorName: '<img src=x onerror=alert(1)>',
    studentName: 'Alex & Sam',
    entryTitle: 'Ward <script>alert(1)</script>',
    approvalUrl: 'https://example.test/approve?a=1&b=2',
  });

  assert.equal(html.includes('<script>'), false);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes(escapeHtml('Alex & Sam')), true);
  assert.equal(html.includes('a=1&amp;b=2'), true);
});

test('email configuration is explicit and provider-free standalone mode is supported', () => {
  assert.equal(isEmailConfigured({ RESEND_API_KEY: '' }), false);
  assert.equal(isEmailConfigured({ RESEND_API_KEY: 're_test_key' }), true);
});
