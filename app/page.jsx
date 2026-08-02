import SiteHeader from '@/components/marketing/SiteHeader';
import Hero from '@/components/marketing/Hero';
import JourneyTimeline from '@/components/marketing/JourneyTimeline';
import FeatureHighlights from '@/components/marketing/FeatureHighlights';
import FacultyGrid from '@/components/marketing/FacultyGrid';
import EmployersSection from '@/components/marketing/EmployersSection';
import SiteFooter from '@/components/marketing/SiteFooter';

export default function Landing() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <JourneyTimeline />
        <FeatureHighlights />
        <FacultyGrid />
        <EmployersSection />
      </main>
      <SiteFooter />
    </>
  );
}
