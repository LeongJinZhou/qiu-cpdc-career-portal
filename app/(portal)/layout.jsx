import { PortalProvider } from '@/components/portal/PortalProvider';
import PortalShell from '@/components/portal/PortalShell';
import RoleGuard from '@/components/portal/RoleGuard';

/**
 * Shell for every authenticated module route. Each module is now its own page
 * rather than a tab inside one giant component, so the browser back button,
 * deep links and bookmarks all behave as students expect.
 */
export default function PortalLayout({ children }) {
  return (
    <PortalProvider>
      <PortalShell>
        <RoleGuard>{children}</RoleGuard>
      </PortalShell>
    </PortalProvider>
  );
}
