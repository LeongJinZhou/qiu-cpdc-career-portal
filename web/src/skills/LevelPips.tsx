// A skill level 1-5 as five pips, with the words for screen readers.

export const LEVEL_LABEL = ['Not rated', 'Beginner', 'Basic', 'Good', 'Strong', 'Expert'];

export function LevelPips({ level, tone = 'ink' }: { level: number | null; tone?: 'ink' | 'need' }) {
  const value = level ?? 0;
  return (
    <span className={`pips pips-${tone}`} role="img" aria-label={`${LEVEL_LABEL[value]} (${value} of 5)`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} data-on={n <= value} />
      ))}
    </span>
  );
}
