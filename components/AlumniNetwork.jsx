'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  MessageSquare,
  Search,
  Filter,
  Calendar,
  Send,
  CheckCircle2,
  ThumbsUp,
  PlusCircle,
  MapPin,
  X,
  UserPlus,
  Sparkles,
  Trophy,
  Clock,
  ArrowRight,
  Quote
} from 'lucide-react';
import { ALUMNI_DIRECTORY, FEED_POSTS, FACULTIES } from '@/lib/data/facultyData';
import { useAccessibleTabs } from '@/components/ui/useAccessibleTabs';
import DismissibleDialog from '@/components/ui/DismissibleDialog';

// --- Small helpers -----------------------------------------------------------

// Initials from a display name, capped at two letters. Used for the avatar
// fallback so a failed remote image never shows a broken-image icon.
function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
}

// Avatar that renders the remote photo but swaps to an initials tile if the
// image is missing or errors out. Sizing/rounding come in via className.
function Avatar({ name, src, className = '', textClass = 'text-sm' }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center bg-crimson/10 text-crimson font-heading font-bold border border-black/10 ${textClass} ${className}`}
      >
        {initialsOf(name)}
      </div>
    );
  }
  return (
    /* An uploaded photo has no host known at build time, so next/image cannot
       be configured for it; onError falls back to the initials above.
       TODO: converge this on components/ui/Avatar, which does the same thing
       with a size prop — the two differ only in how they take their sizing. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setErrored(true)}
      className={`object-cover ${className}`}
    />
  );
}

// Success-story fixtures. FEED_POSTS is the co-founder/project board and does
// not fit a career-journey narrative, so short alumni stories live here.
const SUCCESS_STORIES = [
  {
    id: 'story-1',
    name: 'Samantha Tan',
    facultyId: 'computing_engineering',
    faculty: 'Computing & Engineering',
    role: 'Senior Software Engineer @ Meridian Cloud',
    graduationYear: 2023,
    avatar: ALUMNI_DIRECTORY.find((a) => a.id === 'alum-1')?.avatar,
    headline: 'From FYP demo to search infrastructure in 18 months',
    story:
      'My Year 3 logbook and FYP on distributed caching became the story I told in every interview. The CPDC mock interviews got me comfortable talking about trade-offs, and that landed the L4 offer.'
  },
  {
    id: 'story-2',
    name: 'Rachel Dupont',
    facultyId: 'business',
    faculty: 'Business',
    role: 'IB Associate @ Straits Capital Partners',
    graduationYear: 2022,
    avatar: ALUMNI_DIRECTORY.find((a) => a.id === 'alum-3')?.avatar,
    headline: 'Case competition finalist to the Hong Kong deal desk',
    story:
      'Winning the regional FMCG case competition gave me a verified badge recruiters actually asked about. Three alumni coffee chats later I had a referral into the summer analyst pipeline.'
  },
  {
    id: 'story-3',
    name: 'Dr. Kevin Ramasamy',
    facultyId: 'medicine',
    faculty: 'Medicine',
    role: 'Cardiology Fellow @ Northshore Teaching Hospital',
    graduationYear: 2021,
    avatar: ALUMNI_DIRECTORY.find((a) => a.id === 'alum-2')?.avatar,
    headline: '140 logged shift hours that opened the UK training door',
    story:
      'The verified clinical shift log was the difference in my MRCP application. Happy to pay it forward — book a slot and I’ll walk you through rotation strategy.'
  }
];

export default function AlumniNetwork({ student, activeFaculty, currentRole = 'STUDENT' }) {
  const isAlumni = currentRole === 'ALUMNI';
  const canInteract = currentRole === 'STUDENT' || isAlumni;
  const canBookMentor = currentRole === 'STUDENT';
  const [activeTab, setActiveTab] = useState('alumni'); // 'alumni' | 'stories' | 'feed'
  const { getTabProps } = useAccessibleTabs(['alumni', 'stories', 'feed'], activeTab, setActiveTab);
  const [selectedFacultyFilter, setSelectedFacultyFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Mentor availability toggle, keyed by alum id. Alumni with open slots
  // default to "available to mentor"; a student viewing a card can see the
  // live state and only available mentors expose bookable slots.
  const [mentorAvailable, setMentorAvailable] = useState(() =>
    Object.fromEntries(ALUMNI_DIRECTORY.map((a) => [a.id, a.coffeeChatSlots.length > 0]))
  );

  // Connection Request Modal State (mandatory "why are you reaching out?" note)
  const [connectModal, setConnectModal] = useState(null); // alum object
  const [connectNote, setConnectNote] = useState('');
  const [connectSent, setConnectSent] = useState(false);
  const [sentConnections, setSentConnections] = useState({}); // { [alumId]: true }

  // Mentorship Slot Booking State (in-memory confirmed bookings)
  const [bookingModal, setBookingModal] = useState(null); // alum object
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookedSuccess, setBookedSuccess] = useState(false);
  const [bookingTopic, setBookingTopic] = useState('');
  const [bookings, setBookings] = useState([]); // { id, alumId, alumName, slot }

  // Discussion Feed State
  const [postsList, setPostsList] = useState(FEED_POSTS);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [showNewPostModal, setShowNewPostModal] = useState(false);

  useEffect(() => {
    if (!connectModal && !bookingModal && !showNewPostModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setConnectModal(null);
      setBookingModal(null);
      setShowNewPostModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [bookingModal, connectModal, showNewPostModal]);

  const filteredAlumni = ALUMNI_DIRECTORY.filter((alum) => {
    const matchesFaculty = selectedFacultyFilter === 'ALL' || alum.facultyId === selectedFacultyFilter;
    const matchesQuery =
      alum.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alum.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alum.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFaculty && matchesQuery;
  });

  // --- AI-suggested matches --------------------------------------------------
  // Rank alumni by relevance to the student's faculty and career target. Same
  // faculty is the strongest signal; overlapping keywords between the alum's
  // role/company/bio and the student's programme add incremental weight.
  const suggestedAlumni = useMemo(() => {
    const target = `${student.programme} ${activeFaculty.name}`.toLowerCase();
    const targetWords = [...new Set(target.split(/\W+/).filter((w) => w.length > 3))];

    const scoreAlum = (alum) => {
      let score = 0;
      const reasons = [];
      if (alum.facultyId === student.facultyId) {
        score += 5;
        reasons.push('Same faculty');
      }
      const haystack = `${alum.role} ${alum.company} ${alum.bio} ${alum.programme}`.toLowerCase();
      const hits = targetWords.filter((w) => haystack.includes(w));
      score += hits.length;
      if (hits.length > 0 && reasons.length === 0) reasons.push('Career-path overlap');
      if (mentorAvailable[alum.id]) {
        score += 1;
        reasons.push('Mentoring now');
      }
      return { alum, score, reason: reasons[0] || 'Broaden your network' };
    };

    return [...ALUMNI_DIRECTORY]
      .map(scoreAlum)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [student, activeFaculty, mentorAvailable]);

  const openConnect = (alum) => {
    setConnectModal(alum);
    setConnectNote('');
    setConnectSent(false);
  };

  const handleSendConnection = (e) => {
    e.preventDefault();
    // The note is mandatory: an empty / whitespace-only reason can't be sent.
    if (!connectNote.trim()) return;
    setConnectSent(true);
    setSentConnections((prev) => ({ ...prev, [connectModal.id]: true }));
  };

  const openBooking = (alum) => {
    setBookingModal(alum);
    setSelectedSlot(alum.coffeeChatSlots[0] || '');
    setBookingTopic('');
    setBookedSuccess(false);
  };

  const handleBookSlot = (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    // Record the booking in-memory so the card + summary can reflect it.
    //
    // `topic` is captured here deliberately. The textarea used to be
    // uncontrolled and was never read, so a student wrote a considered request
    // to a mentor and it evaporated on submit -- the worst kind of bug,
    // because nothing appeared to fail.
    setBookings((prev) => [
      ...prev.filter((b) => b.alumId !== bookingModal.id),
      {
        id: 'bk-' + Date.now(),
        alumId: bookingModal.id,
        alumName: bookingModal.name,
        slot: selectedSlot,
        topic: bookingTopic.trim(),
      }
    ]);
    setBookedSuccess(true);
  };

  const bookingFor = (alumId) => bookings.find((b) => b.alumId === alumId);

  const toggleMentor = (alumId) => {
    setMentorAvailable((prev) => ({ ...prev, [alumId]: !prev[alumId] }));
  };

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newPostTitle || !newPostContent) return;

    const newP = {
      id: 'post-' + Date.now(),
      author: student.name,
      faculty: activeFaculty.name,
      year: `Year ${student.year} Student`,
      time: 'Just now',
      avatar: student.avatarUrl,
      title: newPostTitle,
      content: newPostContent,
      tags: ['CrossFaculty', 'Networking'],
      likes: 1,
      comments: 0
    };

    setPostsList([newP, ...postsList]);
    setNewPostTitle('');
    setNewPostContent('');
    setShowNewPostModal(false);
  };

  const handleLikePost = (pId) => {
    setPostsList((prev) => prev.map((p) => (p.id === pId ? { ...p, likes: p.likes + 1 } : p)));
  };

  return (
    <div className="space-y-8 animate-fadeIn">

      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-black/10 pb-6">
        <div className="space-y-1.5">
          <h2 className="section-title font-heading text-[#1d1d1f] flex items-center gap-2.5">
            <Users className="w-5 h-5 text-crimson" />
            <span>Alumni Mentorship & Cross-Faculty Social Network</span>
          </h2>
          <p className="section-subtitle max-w-2xl">
            {isAlumni
              ? 'Manage your mentoring presence, share a verified career journey, and collaborate with the next QIU cohort.'
              : 'Find working alumni in your faculty and target industries, request a focused conversation, and build cross-faculty collaborations.'}
          </p>
        </div>

        <div className="flex max-w-full items-center gap-1 overflow-x-auto bg-black/[0.03] p-1 rounded-xl border border-black/10 shrink-0" role="tablist" aria-label="Alumni network views">
          {[
            { id: 'alumni', label: 'Alumni Mentors' },
            { id: 'stories', label: 'Success Stories' },
            { id: 'feed', label: 'Cross-Faculty Feed' }
          ].map((tab) => (
            <button
              key={tab.id}
              {...getTabProps(tab.id)}
              type="button"
              role="tab"
              id={`network-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`network-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                activeTab === tab.id ? 'bg-crimson text-white' : 'text-muted hover:text-[#1d1d1f]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: ALUMNI DIRECTORY, SUGGESTIONS, CONNECT & MENTORSHIP */}
      {activeTab === 'alumni' && (
        <div id="network-panel-alumni" role="tabpanel" aria-labelledby="network-tab-alumni" className="space-y-6">

          {/* AI-Suggested Matches strip */}
          <div className="surface p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-crimson" />
              <h3 className="font-heading font-bold text-sm text-[#1d1d1f]">Suggested for you</h3>
              <span className="text-xs text-muted">Ranked for {activeFaculty.name}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {suggestedAlumni.map(({ alum, reason }) => (
                <button
                  key={alum.id}
                  type="button"
                  onClick={() => canInteract && openConnect(alum)}
                  disabled={!canInteract}
                  className="surface-interactive text-left p-3.5 rounded-[14px] border border-black/10 flex items-center gap-3 hover:border-crimson/40 transition"
                >
                  <Avatar name={alum.name} src={alum.avatar} className="w-11 h-11 rounded-xl shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1d1d1f] truncate">{alum.name}</p>
                    <p className="text-xs text-muted truncate">{alum.company}</p>
                    <span className="badge-pill text-[10px] px-2 py-0.5 mt-1 inline-block bg-crimson/10 text-crimson border border-crimson/20">
                      {reason}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Confirmed bookings summary (in-memory) */}
          {bookings.length > 0 && (
            <div className="surface p-4 flex flex-wrap items-center gap-3 border-emerald-200 bg-emerald-50/40">
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> {bookings.length} mentorship {bookings.length === 1 ? 'booking' : 'bookings'} confirmed:
              </span>
              {bookings.map((b) => (
                <span key={b.id} className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {b.alumName} &bull; {b.slot}
                </span>
              ))}
            </div>
          )}

          {/* Search & Filters */}
          <div className="surface p-5 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="Search alumni by name, company, or role"
                placeholder="Search alumni by name, company, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-black/[0.04] border border-black/10 text-sm text-[#1d1d1f] focus:outline-none focus:border-crimson transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1">
              <span className="text-xs text-muted flex items-center gap-1.5 font-semibold shrink-0">
                <Filter className="w-3.5 h-3.5" /> Faculty:
              </span>
              <button
                onClick={() => setSelectedFacultyFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                  selectedFacultyFilter === 'ALL' ? 'bg-crimson text-white' : 'bg-black/[0.03] text-muted hover:bg-black/[0.06]'
                }`}
              >
                All
              </button>
              {FACULTIES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFacultyFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                    selectedFacultyFilter === f.id ? 'bg-crimson text-white' : 'bg-black/[0.03] text-muted hover:bg-black/[0.06]'
                  }`}
                >
                  {f.code}
                </button>
              ))}
            </div>
          </div>

          {/* Directory Cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {filteredAlumni.map((alum) => {
              const isAvailable = mentorAvailable[alum.id];
              const booked = bookingFor(alum.id);
              const requested = sentConnections[alum.id];
              return (
                <div key={alum.id} className="surface surface-interactive p-6 space-y-5 flex flex-col justify-between hover:border-crimson/40">

                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Avatar name={alum.name} src={alum.avatar} className="w-16 h-16 rounded-2xl shrink-0" textClass="text-lg" />
                      <div className="min-w-0">
                        <h3 className="break-words font-heading text-lg font-bold leading-tight text-[#1d1d1f]">{alum.name}</h3>
                        <p className="break-words text-sm font-medium text-crimson">{alum.role} <span className="text-muted">@</span> <span className="font-semibold text-[#1d1d1f]">{alum.company}</span></p>
                        <span className="text-xs text-muted flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {alum.location} &bull; Class of {alum.graduationYear}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-[#424245] bg-black/[0.03] p-4 rounded-[14px] border border-black/[0.06] leading-relaxed italic">
                      &ldquo;{alum.bio}&rdquo;
                    </p>

                    {/* Students get a read-only availability signal. A real
                        alumni profile will own the write action once the
                        network tables are connected. */}
                    <div className="flex items-center justify-between px-1">
                      {/* The label carries the state, not the dot.
                          This read "Available to mentor" for every alum
                          regardless of `isAvailable`, with only an emerald-vs-grey
                          dot distinguishing them -- so the text was actively
                          wrong for unavailable mentors, and a colourblind or
                          screen-reader user got the opposite of the truth. */}
                      <span className="text-xs font-semibold text-[#424245] flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-black/20'}`}
                          aria-hidden="true"
                        />
                        {isAvailable ? 'Available to mentor' : 'Not mentoring right now'}
                      </span>
                      {isAlumni ? (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isAvailable}
                          aria-label={`Toggle mentorship availability for ${alum.name}`}
                          onClick={() => toggleMentor(alum.id)}
                          className={`relative h-6 w-10 shrink-0 rounded-full transition ${isAvailable ? 'bg-crimson' : 'bg-black/15'}`}
                        >
                          <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isAvailable ? 'translate-x-4' : ''}`} />
                        </button>
                      ) : <span className="text-[11px] text-muted">Read-only</span>}
                    </div>

                    {/* Bookable slots (only when available) */}
                    {isAvailable && !booked && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {alum.coffeeChatSlots.length} slots open</span>
                      </div>
                    )}
                    {booked && (
                      <div className="text-xs px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Booked: {booked.slot}
                      </div>
                    )}
                    {!isAvailable && (
                      <div className="text-xs px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                        Not accepting mentorship bookings right now.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-black/10 pt-4 sm:flex-row sm:items-center sm:gap-3">
                    <Link href={`/network/${encodeURIComponent(alum.id)}`} className="secondary-btn w-full sm:flex-1">
                      View full profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => canInteract && openConnect(alum)}
                      disabled={requested || !canInteract}
                      className={`secondary-btn w-full sm:flex-1 ${requested ? 'opacity-60 cursor-default' : ''}`}
                    >
                      {requested ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <UserPlus className="w-4 h-4" />}
                      <span>{requested ? 'Request Sent' : canInteract ? 'Connect' : 'View only'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => canBookMentor && openBooking(alum)}
                      disabled={!canBookMentor || !isAvailable || !!booked}
                      className={`crimson-btn w-full sm:flex-1 ${(!isAvailable || booked) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>{booked ? 'Booked' : canBookMentor ? 'Book Slot' : 'Student booking'}</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* TAB 2: ALUMNI SUCCESS STORIES */}
      {activeTab === 'stories' && (
        <div id="network-panel-stories" role="tabpanel" aria-labelledby="network-tab-stories" className="space-y-6">
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-[#1d1d1f] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-crimson" /> Alumni Career Journeys
            </h3>
            <p className="text-sm text-muted">Short stories from QIU graduates on how their logbook, badges and mentorship turned into offers.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {SUCCESS_STORIES.map((s) => (
              <article key={s.id} className="surface p-6 space-y-4 flex flex-col">
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} src={s.avatar} className="w-12 h-12 rounded-2xl shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-heading font-bold text-sm text-[#1d1d1f] truncate">{s.name}</h4>
                    <p className="text-xs text-crimson font-medium truncate">{s.role}</p>
                    <p className="text-xs text-muted">{s.faculty} &bull; Class of {s.graduationYear}</p>
                  </div>
                </div>

                <h3 className="font-heading font-bold text-base text-[#1d1d1f] leading-snug">{s.headline}</h3>

                <p className="text-sm text-[#424245] leading-relaxed bg-black/[0.03] p-4 rounded-[14px] border border-black/[0.06] relative">
                  <Quote className="w-4 h-4 text-crimson/40 mb-1" />
                  {s.story}
                </p>

                <div className="pt-2 mt-auto">
                  <button
                    onClick={() => { setActiveTab('alumni'); }}
                    className="text-xs font-semibold text-crimson flex items-center gap-1 hover:gap-2 transition-all"
                  >
                    Find a mentor like this <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CROSS-FACULTY DISCUSSION FEED */}
      {activeTab === 'feed' && (
        <div id="network-panel-feed" role="tabpanel" aria-labelledby="network-tab-feed" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-lg text-[#1d1d1f]">Inter-University Startup & Project Board</h3>
              <p className="text-sm text-muted">Post requests for co-founders, research collaborators, or study groups.</p>
            </div>
            <button
              onClick={() => canInteract && setShowNewPostModal(true)}
              disabled={!canInteract}
              className="crimson-btn text-xs shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{canInteract ? 'Create New Discussion Post' : 'Read-only feed for this role'}</span>
            </button>
          </div>

          <div className="space-y-5">
            {postsList.map((post) => (
              <div key={post.id} className="surface p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={post.author} src={post.avatar} className="w-11 h-11 rounded-full" />
                    <div>
                      <h4 className="font-semibold text-sm text-[#1d1d1f]">{post.author}</h4>
                      <p className="text-xs text-muted">{post.faculty} &bull; {post.year}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted">{post.time}</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="font-heading font-bold text-lg text-crimson leading-snug">{post.title}</h3>
                  <p className="text-sm text-[#1d1d1f] leading-relaxed">{post.content}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-black/10">
                  <div className="flex gap-1.5">
                    {post.tags.map((t, idx) => (
                      <span key={idx} className="badge-pill text-xs px-2.5 py-1 bg-black/[0.03] text-[#424245] border border-black/[0.06]">
                        #{t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleLikePost(post.id)}
                      className="flex items-center gap-1.5 text-xs text-muted hover:text-crimson font-semibold transition"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{post.likes}</span>
                    </button>

                    <span className="flex items-center gap-1.5 text-xs text-muted font-semibold">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{post.comments} Comments</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONNECTION REQUEST MODAL (mandatory reaching-out note) */}
      {connectModal && (
        <DismissibleDialog onClose={() => setConnectModal(null)} labelledBy="connect-heading" className="bg-surface border border-black/10 rounded-[18px] p-7 max-w-md w-full space-y-5 relative shadow-lg">
            <button
              type="button"
              onClick={() => setConnectModal(null)}
              aria-label="Close connection request"
              className="absolute top-4 right-4 text-muted hover:text-[#1d1d1f] p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <Avatar name={connectModal.name} src={connectModal.avatar} className="w-12 h-12 rounded-2xl" />
              <div>
                <h3 id="connect-heading" className="font-heading font-bold text-lg text-[#1d1d1f]">Send Connection Request</h3>
                <p className="text-sm text-crimson font-medium">{connectModal.name} ({connectModal.company})</p>
              </div>
            </div>

            {connectSent ? (
              <div className="p-5 rounded-[14px] bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-semibold text-emerald-700 text-sm">Connection Request Sent!</h4>
                <p className="text-xs text-[#424245]">{connectModal.name} will see your note and can accept to open a chat.</p>
                <button
                  type="button"
                  onClick={() => setConnectModal(null)}
                  className="secondary-btn text-xs justify-center mx-auto mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendConnection} className="space-y-4">
                <div>
                  <label htmlFor="connect-note" className="block text-xs font-semibold text-[#424245] mb-2">
                    Why are you reaching out? <span className="text-crimson">*</span>
                  </label>
                  <textarea
                    id="connect-note"
                    rows={4}
                    value={connectNote}
                    onChange={(e) => setConnectNote(e.target.value)}
                    placeholder="A short, specific note gets far more replies. e.g. I'm a Year 3 CS student prepping for MNC backend interviews and would value 15 minutes on how you scoped your first production project..."
                    className="w-full p-3.5 rounded-xl bg-black/[0.04] border border-black/10 text-xs text-[#1d1d1f] focus:outline-none focus:border-crimson"
                    required
                  />
                  <p className="text-[11px] text-muted mt-1.5">A personal note is required — blank requests can’t be sent.</p>
                </div>

                <button
                  type="submit"
                  disabled={!connectNote.trim()}
                  className={`w-full crimson-btn justify-center text-xs py-3 ${!connectNote.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Send className="w-4 h-4" />
                  <span>Send Connection Request</span>
                </button>
              </form>
            )}
        </DismissibleDialog>
      )}

      {/* MENTORSHIP SLOT BOOKING MODAL */}
      {bookingModal && (
        <DismissibleDialog onClose={() => setBookingModal(null)} labelledBy="booking-heading" className="bg-surface border border-black/10 rounded-[18px] p-7 max-w-md w-full space-y-5 relative shadow-lg">
            <button
              type="button"
              onClick={() => setBookingModal(null)}
              aria-label="Close mentorship booking"
              className="absolute top-4 right-4 text-muted hover:text-[#1d1d1f] p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <Avatar name={bookingModal.name} src={bookingModal.avatar} className="w-12 h-12 rounded-2xl" />
              <div>
                <h3 id="booking-heading" className="font-heading font-bold text-lg text-[#1d1d1f]">Book a Mentorship Slot</h3>
                <p className="text-sm text-crimson font-medium">{bookingModal.name} ({bookingModal.company})</p>
              </div>
            </div>

            {bookedSuccess ? (
              <div className="p-5 rounded-[14px] bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-semibold text-emerald-700 text-sm">Slot Confirmed!</h4>
                <p className="text-xs text-[#424245]">{selectedSlot} with {bookingModal.name}. The booking is recorded in this view; calendar/email delivery will appear here once the notification provider is configured.</p>
                <button
                  type="button"
                  onClick={() => setBookingModal(null)}
                  className="secondary-btn text-xs justify-center mx-auto mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleBookSlot} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#424245] mb-2">Select Available Mentorship Slot</label>
                  <div className="space-y-2">
                    {bookingModal.coffeeChatSlots.map((slot, idx) => (
                      <label
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition ${
                          selectedSlot === slot ? 'bg-crimson/15 border-crimson text-crimson font-semibold' : 'bg-black/[0.03] border-black/[0.06] text-[#424245]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted" />
                          {slot}
                        </span>
                        <input
                          type="radio"
                          name="slot"
                          checked={selectedSlot === slot}
                          onChange={() => setSelectedSlot(slot)}
                          className="accent-crimson"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="booking-topic" className="block text-xs font-semibold text-[#424245] mb-2">Topic / Advice Requested</label>
                  <textarea
                    id="booking-topic"
                    rows={3}
                    value={bookingTopic}
                    onChange={(event) => setBookingTopic(event.target.value)}
                    placeholder="e.g. Would love advice on interviewing for MNC software engineering roles and resume tips..."
                    className="w-full p-3.5 rounded-xl bg-black/[0.04] border border-black/10 text-xs text-[#1d1d1f] placeholder:text-black/40 focus:outline-none focus:border-crimson"
                    required
                  />
                </div>

                <button type="submit" className="w-full crimson-btn justify-center text-xs py-3">
                  <Calendar className="w-4 h-4" />
                  <span>Confirm Booking</span>
                </button>
              </form>
            )}
        </DismissibleDialog>
      )}

      {/* NEW POST MODAL */}
      {showNewPostModal && (
        <DismissibleDialog onClose={() => setShowNewPostModal(false)} labelledBy="new-post-heading" className="bg-surface border border-black/10 rounded-[18px] p-7 max-w-lg w-full space-y-5 relative shadow-lg">
            <button
              type="button"
              onClick={() => setShowNewPostModal(false)}
              aria-label="Close new discussion post"
              className="absolute top-4 right-4 text-muted hover:text-[#1d1d1f] p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 id="new-post-heading" className="font-heading font-bold text-lg text-[#1d1d1f]">Create Inter-Faculty Discussion Post</h3>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label htmlFor="new-post-title" className="block text-xs font-semibold text-[#424245] mb-2">Post Title</label>
                <input
                  id="new-post-title"
                  type="text"
                  placeholder="e.g. Looking for a CS Student for a Biotech Startup App"
                  value={newPostTitle}
                  onChange={(e) => setNewPostTitle(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-black/[0.04] border border-black/10 text-xs text-[#1d1d1f] focus:outline-none focus:border-crimson"
                  required
                />
              </div>

              <div>
                <label htmlFor="new-post-content" className="block text-xs font-semibold text-[#424245] mb-2">Discussion Content</label>
                <textarea
                  id="new-post-content"
                  rows={4}
                  placeholder="Detail your request, project scope, or study group topic..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="w-full p-3.5 rounded-xl bg-black/[0.04] border border-black/10 text-xs text-[#1d1d1f] focus:outline-none focus:border-crimson"
                  required
                />
              </div>

              <button type="submit" className="w-full crimson-btn justify-center text-xs py-3">
                <Send className="w-4 h-4" />
                <span>Post to University Discussion Board</span>
              </button>
            </form>
        </DismissibleDialog>
      )}

    </div>
  );
}
