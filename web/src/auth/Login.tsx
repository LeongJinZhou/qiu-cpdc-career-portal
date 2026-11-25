// Sign-in: Google for students and staff, LinkedIn for graduates (docs/SPEC.md rules 1 and 8).
import { Notice } from '../ui/parts';
import { GoogleMark, LinkedInMark } from './ProviderMarks';
import './auth.css';

/** Short reason codes from the server's redirect; the detail stays in the sign-in log. */
export const LOGIN_ERRORS: Record<string, string> = {
  domain: 'Use your QIU Google account (name@qiu.edu.my). Personal Google accounts cannot sign in.',
  inactive: 'This account is switched off. Please contact CPDC.',
  busy: 'Too many sign-in attempts from here. Please wait a minute and try again.',
  failed: 'Sign-in did not finish. Please try again.',
  'linkedin-off': 'LinkedIn sign-in is not switched on yet. Please contact CPDC.',
  'linkedin-cancelled': 'LinkedIn sign-in was cancelled.',
  'linkedin-expired': 'The sign-in took too long. Please try again.',
  'linkedin-waiting': 'CPDC is still checking your graduate registration. You can sign in once it is approved.',
  'linkedin-not-alumni': 'LinkedIn sign-in is for graduates. Current students and staff sign in with Google.',
  'linkedin-failed': 'LinkedIn sign-in did not finish. Please try again.',
};

export function Login({ error }: { error: string | null }) {
  const message = error ? (LOGIN_ERRORS[error] ?? LOGIN_ERRORS.failed) : null;
  return (
    <main className="auth">
      <div className="auth-card">
        <img className="auth-logo" src="/brand/qiu-logo-horizontal-dark.png" alt="Quest International University" />
        <div className="auth-head">
          <h1>Career Portal</h1>
          <p>Your career profile at QIU, kept with you from your first semester to long after graduation.</p>
        </div>
        {message && <Notice tone="error">{message}</Notice>}
        <div className="panel panel-pad stack">
          <a className="btn btn-primary btn-block" href="/api/auth/google/start">
            <span className="row" style={{ background: '#fff', borderRadius: 4, padding: 3 }}>
              <GoogleMark />
            </span>
            Sign in with QIU Google
          </a>
          <p className="small muted">Students and staff: use your @qiu.edu.my account.</p>
          <div className="auth-or">Graduated?</div>
          <a className="btn btn-block" href="/api/auth/linkedin/start?mode=signin">
            <LinkedInMark />
            Sign in with LinkedIn
          </a>
          <p className="small muted">
            Use the LinkedIn account you linked as a student. Graduated before this portal? Sign in with LinkedIn
            and you can register as a QIU graduate.
          </p>
        </div>
        <p className="auth-foot">
          By signing in you agree that CPDC keeps your career profile to support you and to report on graduate
          outcomes. <a href="/privacy">How your data is used</a>
        </p>
      </div>
    </main>
  );
}
