'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Calendar, GraduationCap, MapPin, MessageSquare } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { ALUMNI_DIRECTORY } from '@/lib/data/facultyData';

export default function AlumniProfilePage() {
  const params = useParams();
  const alumni = ALUMNI_DIRECTORY.find((entry) => entry.id === params.id);
  if (!alumni) return <div className="surface space-y-4 p-6"><h1 className="font-heading text-xl font-bold">Alumni profile not found</h1><Link href="/network" className="secondary-btn inline-flex"><ArrowLeft className="h-4 w-4" /> Back to network</Link></div>;

  return (
    <article className="space-y-6 animate-fadeIn">
      <Link href="/network" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-[#1d1d1f]"><ArrowLeft className="h-4 w-4" /> Back to alumni network</Link>
      <header className="surface flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <Avatar name={alumni.name} src={alumni.avatar} size={112} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-crimson">QIU alumni mentor</p>
          <h1 className="mt-2 break-words font-heading text-3xl font-bold leading-tight">{alumni.name}</h1>
          <p className="mt-2 break-words text-base font-semibold text-[#424245]">{alumni.role} · {alumni.company}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{alumni.location}</span><span className="inline-flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" />{alumni.programme}</span><span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Class of {alumni.graduationYear}</span></div>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="surface space-y-4 p-6"><h2 className="font-heading text-xl font-bold">About this mentor</h2><p className="text-sm leading-relaxed text-[#424245]">{alumni.bio}</p><div className="rounded-[16px] border border-crimson/15 bg-crimson/[0.04] p-4"><p className="text-xs font-bold uppercase tracking-wide text-crimson">Why connect</p><p className="mt-1 text-sm leading-relaxed text-[#424245]">This profile is matched using faculty, programme and career interests. Send a specific question so the mentor knows how to help.</p></div></section>
        <aside className="space-y-4"><section className="surface space-y-4 p-6"><h2 className="font-heading text-lg font-bold">Mentorship availability</h2><p className="text-sm text-muted">{alumni.coffeeChatSlots.length} conversation slots are currently listed.</p><ul className="space-y-2">{alumni.coffeeChatSlots.map((slot) => <li key={slot} className="flex items-center gap-2 rounded-[12px] border border-black/10 bg-black/[0.025] p-3 text-xs font-semibold"><Calendar className="h-4 w-4 text-crimson" />{slot}</li>)}</ul><Link href="/network" className="crimson-btn min-h-[46px] justify-center"><MessageSquare className="h-4 w-4" /> Connect from network</Link></section><section className="surface flex items-center gap-3 p-5 text-sm text-muted"><BriefcaseBusiness className="h-5 w-5 shrink-0 text-crimson" /><span>Career context is shared by the alumni member for mentoring purposes.</span></section></aside>
      </div>
    </article>
  );
}

