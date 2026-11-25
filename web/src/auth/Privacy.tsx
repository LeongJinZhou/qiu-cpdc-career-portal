// How the portal uses personal data (PDPA notice, consent version 2026-11-25). Read mode: plain and short.
import './auth.css';

export function Privacy() {
  return (
    <main className="auth">
      <article className="auth-card wide stack">
        <img className="auth-logo" src="/brand/qiu-logo-horizontal-dark.png" alt="Quest International University" />
        <h1>How your data is used</h1>
        <div className="panel panel-pad stack">
          <h2>What we keep</h2>
          <p>
            From your QIU Google account: your name, photo, QIU email, matric or staff number, faculty or department
            and job title. From LinkedIn: your name, photo, LinkedIn email and the profile link you give us. From you:
            the career details you add or import from your LinkedIn PDF, and your job after graduation.
          </p>
          <h2>What we never do</h2>
          <p>
            We never ask for your LinkedIn or Google password, never read your LinkedIn pages, and never keep the PDF
            you upload: it is read once and deleted.
          </p>
          <h2>Who sees it</h2>
          <p>
            You, the CPDC team and the portal administrator see your full profile. Other staff see your name, faculty
            and LinkedIn link. Every time CPDC views or exports the alumni list, it is recorded.
          </p>
          <h2>Why</h2>
          <p>
            To support your career while you study, to keep in touch after you graduate, and to report how QIU
            graduates are doing (for example the employment rate per faculty).
          </p>
          <h2>Your choices</h2>
          <p>
            You can update or clear your career details at any time on your profile. To have your account removed,
            contact CPDC.
          </p>
        </div>
        <a className="small" href="/">Back</a>
      </article>
    </main>
  );
}
