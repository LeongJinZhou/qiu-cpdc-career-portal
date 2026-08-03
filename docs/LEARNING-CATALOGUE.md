# Learning catalogue — how it stays live

The external-learning catalogue (Coursera / edX / LinkedIn Learning) is a
database table, not a file. That exists to satisfy one requirement: **a course
the provider takes down must disappear from the student portal without a code
deploy.**

## Running the sync

```bash
npm run catalog:sync
```

| Flag | What it does |
| --- | --- |
| *(none)* | Import the curated source list, check every URL, recompute trending |
| `--check` | Liveness + trending only. **This is the one to schedule.** |
| `--import` | Import only, no network calls |
| `--dry-run` | Report what would change, write nothing |

Schedule `--check` **once a day**. More often adds nothing: providers do not
retire courses hourly, and a lighter touch keeps us well inside their tolerance.

## How a take-down is decided

Owned by `lib/learning/liveness.js`. Deliberately cautious, because a catalogue
that empties itself during a provider outage is worse than one stale entry —
students stop trusting it.

A course counts as **gone** only on an unambiguous signal:

- HTTP `404` or `410`, or
- a `200` that redirected onto the provider's `/search` or `/browse` page —
  which is how Coursera and edX actually retire a course.

Everything else — `403`, `429`, `5xx`, timeouts, network errors — is
**inconclusive** and *never* hides a course.

A course is delisted only after **two consecutive** confirmed-gone probes
(`FAILURE_THRESHOLD`). An inconclusive probe between two 404s does not reset the
count: a retired course that also happened to time out once is still retired.

A course that starts resolving again is **restored automatically** on the next
run, and `unavailableSince` is cleared.

## Who sees what

| Audience | Query | Sees |
| --- | --- | --- |
| Students | `GET /api/learning/catalog` | `PUBLISHED` and not `UNAVAILABLE` |
| CPDC staff | `GET /api/learning/catalog?scope=all` | Everything, including delisted rows |

`UNKNOWN` availability is shown to students on purpose — an unchecked or
inconclusive course stays visible. Only a *confirmed* take-down hides anything.

Two independent fields, never conflated:

- `availability` — owned by the sync. Automated.
- `curationStatus` — owned by CPDC (`PUBLISHED` / `DRAFT` / `ARCHIVED`). Editorial.

An automated take-down can therefore never be mistaken for a staff decision, or
the reverse.

## Adding courses

Add entries to `lib/data/courses-expansion.js`, then run `npm run catalog:sync`.
The sync verifies every URL against the live provider, so a wrong link becomes a
flagged row rather than a broken link a student clicks.

Two content rules apply and are not negotiable:

1. Real courses, with the real publishing organisation in `taughtBy`. Never
   attach an invented instructor to a real course, and never fabricate enrolment
   or rating figures.
2. Nothing claims a QIU partnership with any platform. CPDC *listing* a course
   is not reselling it.

Courses with no `url` are skipped by the importer — an unverifiable link has no
place in front of a student.

## Sorting

Students choose: **Best match**, **Hottest**, **Newest**, **Most XP**, **A–Z**.

Sorting only reorders. Nothing is ever hidden because of a student's faculty —
"Recommended for you" moves a course to the top, it does not remove the rest.
A Business student may take Python.

`trendingScore` = recent enrolments (30-day window, log-scaled) plus a bonus for
new listings that decays over ~8 weeks — so a genuinely new course is
discoverable before it has any enrolments, but novelty never outranks real
popularity.
