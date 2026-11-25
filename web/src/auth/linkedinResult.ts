// What the server's ?linkedin=… after a LinkedIn link means, in the person's words.

export const LINK_RESULTS: Record<string, { tone: 'ok' | 'error'; text: string }> = {
  linked: { tone: 'ok', text: 'LinkedIn is linked to your QIU account.' },
  'in-use': {
    tone: 'error',
    text: 'That LinkedIn account is already linked to another person. Sign in with your own LinkedIn account.',
  },
  cancelled: { tone: 'error', text: 'LinkedIn sign-in was cancelled. Nothing was changed.' },
  expired: { tone: 'error', text: 'The LinkedIn sign-in took too long. Please try again.' },
  off: { tone: 'error', text: 'LinkedIn is not switched on yet. Please contact CPDC.' },
  failed: { tone: 'error', text: 'Linking LinkedIn did not finish. Please try again.' },
};

/** Reads and then removes ?linkedin=… from the address bar, so a reload does not show it again. */
export function takeQueryFlag(name: string): string | null {
  const params = new URLSearchParams(window.location.search);
  const value = params.get(name);
  if (value !== null) {
    params.delete(name);
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }
  return value;
}
