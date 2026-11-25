// Alumni network: an alumnus's own entry and mentoring, everyone's mentoring requests, and the directory.
import { apiGet, useLoad } from '../api';
import { can, type Me } from '../auth';
import { PageHead } from '../shell/Shell';
import { LoadError } from '../ui/parts';
import { Directory } from './Directory';
import { MentorRequests } from './MentorRequests';
import { MyEntry } from './MyEntry';
import type { MentorRequest } from './types';
import './network.css';

export function NetworkPage({ me }: { me: Me }) {
  const isAlumnus = can(me, 'network.own');
  const usesMentoring = isAlumnus || can(me, 'mentoring.request');
  const requests = useLoad('network-requests', () =>
    usesMentoring ? apiGet<{ sent: MentorRequest[]; received: MentorRequest[] }>('/api/network/requests') : Promise.resolve({ sent: [], received: [] }),
  );
  const asked = new Set((requests.data?.sent ?? []).filter((r) => r.status === 'waiting').map((r) => r.person.id));

  return (
    <>
      <PageHead title="Alumni network">
        {isAlumnus
          ? 'Choose what QIU students and staff may see about you, and offer mentoring if you like.'
          : 'QIU graduates who chose to be found. Names open their LinkedIn profile.'}
      </PageHead>
      <div className="net-page">
      {requests.error && <LoadError error={requests.error} onRetry={requests.reload} />}
      {isAlumnus && <MyEntry me={me} />}
      {requests.data && requests.data.received.length > 0 && (
        <MentorRequests me={me} side="received" title="Students asking you" items={requests.data.received} onChanged={requests.reload} />
      )}
      {requests.data && requests.data.sent.length > 0 && (
        <MentorRequests me={me} side="sent" title="Your mentoring requests" items={requests.data.sent} onChanged={requests.reload} />
      )}
      <Directory me={me} askedIds={asked} onAsked={requests.reload} />
      </div>
    </>
  );
}
