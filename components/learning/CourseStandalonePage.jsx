'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { courseById } from '@/lib/data/courses';
import CourseDetail from '@/components/learning/CourseDetail';

export default function CourseStandalonePage() {
  const params = useParams();
  const router = useRouter();
  const course = courseById(params.id);
  if (!course) {
    return <div className="surface space-y-4 p-6"><h1 className="font-heading text-xl font-bold">Course not found</h1><Link href="/learning" className="secondary-btn inline-flex"><ArrowLeft className="h-4 w-4" /> Back to learning</Link></div>;
  }

  return (
    <div className="space-y-4">
      <Link href="/learning" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-[#1d1d1f]"><ArrowLeft className="h-4 w-4" /> Back to learning catalogue</Link>
      <CourseDetail course={course} onClose={() => router.push('/learning')} />
    </div>
  );
}

