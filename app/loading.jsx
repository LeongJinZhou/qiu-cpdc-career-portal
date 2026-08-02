import LoadingScreen from '@/components/LoadingScreen';

/**
 * Route-level loading UI for the public pages (landing, login, onboarding).
 * Next paints this the instant a navigation starts, while the target segment
 * streams in behind it.
 */
export default function Loading() {
  return <LoadingScreen />;
}
