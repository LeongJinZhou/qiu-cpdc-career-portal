import { PortalProvider } from '@/components/portal/PortalProvider';
import PortalShell from '@/components/portal/PortalShell';
import RoleGuard from '@/components/portal/RoleGuard';
import OnboardingGate from '@/components/portal/OnboardingGate';

/**
 * Shell for every authenticated module route. Each module is now its own page
 * rather than a tab inside one giant component, so the browser back button,
 * deep links and bookmarks all behave as students expect.
 *
 * Guard order is deliberate: RoleGuard settles identity first, so OnboardingGate
 * never fires its check for a visitor who is not signed in yet.
 */
export default function PortalLayout({ children }) {
  return (
    <PortalProvider>
      <PortalShell>
        <RoleGuard>
          <OnboardingGate>{children}</OnboardingGate>
        </RoleGuard>
      </PortalShell>
    </PortalProvider>
  );
}
