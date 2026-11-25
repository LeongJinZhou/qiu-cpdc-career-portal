<?php

declare(strict_types=1);

namespace Cpdc\Workshops;

use Cpdc\Audit\Audit;
use Cpdc\Db\Transaction;
use Cpdc\Http\ApiError;
use Cpdc\Http\Paginator;
use PDO;

/**
 * Workshops, RSVP with capacity and waitlist, and check-in. Every time rule uses the caller's clock ($now, unix), so
 * "no RSVP after the start" is the same in tests and in production. Capacity is enforced under a row lock on the
 * workshop, so two people cannot take the last seat at once.
 *
 * @phpstan-type User array{id: int, organisation_id: int, role: string, ...}
 * @phpstan-type Saved array{title: string, description?: string|null, starts_at: string, ends_at: string,
 *     mode: string, venue?: string|null, online_url?: string|null, capacity: int, audience: list<string>}
 */
final class WorkshopService
{
    private const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    private const COLUMNS = 'w.id, w.title, w.description, w.starts_at, w.ends_at, w.mode, w.venue, w.online_url,'
        . ' w.capacity, w.audience, w.checkin_code, w.status,'
        . ' (SELECT COUNT(*) FROM workshop_rsvp g WHERE g.workshop_id = w.id AND g.status = "going") AS going_count,'
        . ' (SELECT COUNT(*) FROM workshop_rsvp q WHERE q.workshop_id = w.id AND q.status = "waitlist")'
        . ' AS waitlist_count,'
        . ' (SELECT COUNT(*) FROM workshop_rsvp c WHERE c.workshop_id = w.id AND c.checked_in_at IS NOT NULL)'
        . ' AS checked_in_count,'
        . ' r.status AS my_status, r.checked_in_at AS my_checked_in_at, r.id AS my_rsvp_id';

    public function __construct(private readonly PDO $pdo, private readonly string $zone)
    {
    }

    /** The audience group a role belongs to; admins count as staff. */
    public static function group(string $role): ?string
    {
        return match ($role) {
            'student' => 'student',
            'alumni' => 'alumni',
            'staff', 'admin', 'superadmin' => 'staff',
            default => null,
        };
    }

    /** A check-in code of 6 characters without look-alikes (no 0/O, 1/I). */
    public static function newCode(): string
    {
        $code = '';
        for ($i = 0; $i < 6; $i++) {
            $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
        }

        return $code;
    }

    /**
     * Upcoming (not ended yet, soonest first) or past (ended, latest first). People see published workshops for
     * their group; managers see every workshop, cancelled ones too.
     *
     * @param User $user
     * @return array{items: list<mixed>, page: int, per_page: int, total: int}
     */
    public function list(array $user, bool $manager, bool $past, Paginator $page, int $now): array
    {
        [$where, $args] = $this->visible($user, $manager);
        $where .= $past ? ' AND w.ends_at <= ?' : ' AND w.ends_at > ?';
        $args[] = WorkshopTime::sql($now);
        $count = $this->pdo->prepare("SELECT COUNT(*) FROM workshop w WHERE $where");
        $count->execute($args);
        $order = $past ? 'w.starts_at DESC, w.id DESC' : 'w.starts_at ASC, w.id ASC';
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM workshop w'
            . ' LEFT JOIN workshop_rsvp r ON r.workshop_id = w.id AND r.user_id = ?'
            . " WHERE $where ORDER BY $order LIMIT " . $page->perPage . ' OFFSET ' . $page->offset()
        );
        $stmt->execute([$user['id'], ...$args]);
        $items = array_values(array_map(
            fn (array $row): array => $this->present($row, $user, $manager, $now),
            $stmt->fetchAll(PDO::FETCH_ASSOC)
        ));

        return $page->envelope($items, (int) $count->fetchColumn());
    }

    /**
     * @param User $user
     * @return array<string, mixed>
     */
    public function get(array $user, bool $manager, int $id, int $now): array
    {
        return $this->present($this->row($user, $manager, $id), $user, $manager, $now);
    }

    /**
     * @param User $admin
     * @param Saved $data
     */
    public function create(array $admin, array $data, int $now): int
    {
        $values = $this->clean($data, $now, null);

        return Transaction::run($this->pdo, function () use ($admin, $values): int {
            $this->pdo->prepare(
                'INSERT INTO workshop (organisation_id, title, description, starts_at, ends_at, mode, venue,'
                . ' online_url, capacity, audience, checkin_code, created_by)'
                . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                $admin['organisation_id'], $values['title'], $values['description'], $values['starts_at'],
                $values['ends_at'], $values['mode'], $values['venue'], $values['online_url'], $values['capacity'],
                $values['audience'], self::newCode(), $admin['id'],
            ]);
            $id = (int) $this->pdo->lastInsertId();
            Audit::log($this->pdo, $admin, 'workshop.create', "workshop:$id", ['title' => $values['title']]);

            return $id;
        });
    }

    /**
     * Edits a workshop. A raised capacity moves people up from the waitlist; a capacity below the number of people
     * going is refused (nobody loses a seat they were given).
     *
     * @param User $admin
     * @param Saved $data
     */
    public function update(array $admin, int $id, array $data, int $now): void
    {
        Transaction::run($this->pdo, function () use ($admin, $id, $data, $now): void {
            $current = $this->locked($admin, $id);
            if ($current['status'] === 'cancelled') {
                throw new ApiError(409, 'WORKSHOP_CANCELLED', 'This workshop is cancelled.');
            }
            $values = $this->clean($data, $now, $current);
            $going = $this->count($id, 'going');
            if ($values['capacity'] < $going) {
                throw new ApiError(
                    409,
                    'CAPACITY_BELOW_GOING',
                    "$going people are already going. The capacity cannot be lower than that."
                );
            }
            $this->pdo->prepare(
                'UPDATE workshop SET title = ?, description = ?, starts_at = ?, ends_at = ?, mode = ?, venue = ?,'
                . ' online_url = ?, capacity = ?, audience = ?, updated_at = UTC_TIMESTAMP(3)'
                . ' WHERE id = ? AND organisation_id = ?'
            )->execute([
                $values['title'], $values['description'], $values['starts_at'], $values['ends_at'], $values['mode'],
                $values['venue'], $values['online_url'], $values['capacity'], $values['audience'],
                $id, $admin['organisation_id'],
            ]);
            $moved = $this->promote($id, $values['capacity']);
            Audit::log($this->pdo, $admin, 'workshop.update', "workshop:$id", ['moved_up' => $moved]);
        });
    }

    /** @param User $admin */
    public function cancel(array $admin, int $id): void
    {
        Transaction::run($this->pdo, function () use ($admin, $id): void {
            $this->locked($admin, $id);
            $this->pdo->prepare(
                'UPDATE workshop SET status = "cancelled", updated_at = UTC_TIMESTAMP(3)'
                . ' WHERE id = ? AND organisation_id = ?'
            )->execute([$id, $admin['organisation_id']]);
            Audit::log($this->pdo, $admin, 'workshop.cancel', "workshop:$id");
        });
    }

    /**
     * RSVP: a seat while there is one, else the waitlist. Refused once the workshop has started.
     *
     * @param User $user
     * @return 'going'|'waitlist'
     */
    public function rsvp(array $user, int $id, int $now): string
    {
        return Transaction::run($this->pdo, function () use ($user, $id, $now): string {
            $workshop = $this->locked($user, $id, false);
            $this->assertOpen($workshop, $now);
            $group = self::group($user['role']);
            if ($group === null || !in_array($group, explode(',', (string) $workshop['audience']), true)) {
                throw new ApiError(403, 'NOT_IN_AUDIENCE', 'This workshop is not open to you.');
            }
            $mine = $this->pdo->prepare(
                'SELECT status FROM workshop_rsvp WHERE workshop_id = ? AND user_id = ? FOR UPDATE'
            );
            $mine->execute([$id, $user['id']]);
            $status = $mine->fetchColumn();
            if ($status === 'going' || $status === 'waitlist') {
                return $status; // asking twice changes nothing
            }
            $new = $this->count($id, 'going') < (int) $workshop['capacity'] ? 'going' : 'waitlist';
            // A cancelled RSVP that comes back is a new row: the waitlist runs in row order, so it joins at the end.
            $this->pdo->prepare('DELETE FROM workshop_rsvp WHERE workshop_id = ? AND user_id = ?')
                ->execute([$id, $user['id']]);
            $this->pdo->prepare(
                'INSERT INTO workshop_rsvp (organisation_id, workshop_id, user_id, status, queued_at)'
                . ' VALUES (?, ?, ?, ?, ?)'
            )->execute([$user['organisation_id'], $id, $user['id'], $new, WorkshopTime::sql($now)]);

            return $new;
        });
    }

    /**
     * Cancels the person's RSVP before the start; a freed seat goes to the first person on the waitlist.
     *
     * @param User $user
     */
    public function cancelRsvp(array $user, int $id, int $now): void
    {
        Transaction::run($this->pdo, function () use ($user, $id, $now): void {
            $workshop = $this->locked($user, $id, false);
            $this->assertOpen($workshop, $now);
            $this->pdo->prepare(
                'UPDATE workshop_rsvp SET status = "cancelled", updated_at = UTC_TIMESTAMP(3)'
                . ' WHERE workshop_id = ? AND user_id = ? AND status IN ("going", "waitlist")'
            )->execute([$id, $user['id']]);
            $this->promote($id, (int) $workshop['capacity']);
        });
    }

    /**
     * The person types the code shown at the venue. Open from setting workshop_checkin_opens_minutes before the
     * start until the end, for people with a seat.
     *
     * @param User $user
     */
    public function checkIn(array $user, int $id, string $code, int $opensMinutes, int $now): void
    {
        Transaction::run($this->pdo, function () use ($user, $id, $code, $opensMinutes, $now): void {
            $workshop = $this->locked($user, $id, false);
            if ($workshop['status'] === 'cancelled') {
                throw new ApiError(409, 'WORKSHOP_CANCELLED', 'This workshop is cancelled.');
            }
            $opens = WorkshopTime::unix((string) $workshop['starts_at']) - $opensMinutes * 60;
            if ($now < $opens || $now >= WorkshopTime::unix((string) $workshop['ends_at'])) {
                throw new ApiError(409, 'CHECKIN_CLOSED', 'Check-in is open only around the workshop time.');
            }
            $mine = $this->pdo->prepare(
                'SELECT status, checked_in_at FROM workshop_rsvp WHERE workshop_id = ? AND user_id = ? FOR UPDATE'
            );
            $mine->execute([$id, $user['id']]);
            $rsvp = $mine->fetch(PDO::FETCH_ASSOC);
            if (!is_array($rsvp) || $rsvp['status'] !== 'going') {
                throw new ApiError(409, 'NO_SEAT', 'Only people with a seat can check in. Ask the CPDC team.');
            }
            if (!hash_equals((string) $workshop['checkin_code'], strtoupper(trim($code)))) {
                throw ApiError::validation('code', 'That code is not right. Check the code on the screen.');
            }
            if ($rsvp['checked_in_at'] === null) {
                $this->pdo->prepare(
                    'UPDATE workshop_rsvp SET checked_in_at = ?, checked_in_by = ?, checkin_method = "code",'
                    . ' updated_at = UTC_TIMESTAMP(3) WHERE workshop_id = ? AND user_id = ?'
                )->execute([WorkshopTime::sql($now), $user['id'], $id, $user['id']]);
            }
        });
    }

    /**
     * CPDC ticks a person on the list (or takes the tick away). Anyone with an RSVP (seat or waitlist) can be
     * ticked: a waitlisted person who came still attended.
     *
     * @param User $admin
     */
    public function markAttendance(array $admin, int $id, int $userId, bool $present, int $now): void
    {
        Transaction::run($this->pdo, function () use ($admin, $id, $userId, $present, $now): void {
            $this->locked($admin, $id);
            $stmt = $this->pdo->prepare(
                'UPDATE workshop_rsvp SET checked_in_at = ?, checked_in_by = ?, checkin_method = ?,'
                . ' updated_at = UTC_TIMESTAMP(3)'
                . ' WHERE workshop_id = ? AND user_id = ? AND organisation_id = ? AND status IN ("going", "waitlist")'
            );
            $stmt->execute([
                $present ? WorkshopTime::sql($now) : null, $present ? $admin['id'] : null, $present ? 'list' : null,
                $id, $userId, $admin['organisation_id'],
            ]);
            $exists = $this->pdo->prepare(
                'SELECT COUNT(*) FROM workshop_rsvp WHERE workshop_id = ? AND user_id = ?'
                . ' AND status IN ("going", "waitlist")'
            );
            $exists->execute([$id, $userId]);
            if ((int) $exists->fetchColumn() === 0) {
                throw new ApiError(404, 'NOT_FOUND', 'This person has no RSVP for this workshop.');
            }
            Audit::log($this->pdo, $admin, 'workshop.attendance', "workshop:$id", [
                'user_id' => $userId, 'present' => $present,
            ]);
        });
    }

    /**
     * Everyone with a seat or on the waitlist, for the check-in list and the CSV (managers only).
     *
     * @param User $admin
     * @return list<array<string, mixed>>
     */
    public function attendees(array $admin, int $id): array
    {
        $this->row($admin, true, $id);
        $stmt = $this->pdo->prepare(
            'SELECT u.id AS user_id, u.display_name, u.email, u.role, u.matric_no, u.employee_id, u.department,'
            . ' u.picture_url, l.profile_url AS linkedin_url, r.status, r.queued_at, r.checked_in_at, r.checkin_method'
            . ' FROM workshop_rsvp r JOIN `user` u ON u.id = r.user_id'
            . ' LEFT JOIN linkedin_account l ON l.user_id = u.id'
            . ' WHERE r.workshop_id = ? AND r.organisation_id = ? AND r.status IN ("going", "waitlist")'
            . ' ORDER BY r.status = "waitlist", r.id'
        );
        $stmt->execute([$id, $admin['organisation_id']]);

        return array_values(array_map(function (array $r): array {
            $r['user_id'] = (int) $r['user_id'];
            $r['queued_at'] = WorkshopTime::iso((string) $r['queued_at']);
            $r['checked_in_at'] = $r['checked_in_at'] === null ? null : WorkshopTime::iso((string) $r['checked_in_at']);

            return $r;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /** The zone the screens and the CSV use. */
    public function zone(): string
    {
        return $this->zone;
    }

    /**
     * @param User $user
     * @return array{0: string, 1: list<int|string>}
     */
    private function visible(array $user, bool $manager): array
    {
        if ($manager) {
            return ['w.organisation_id = ?', [$user['organisation_id']]];
        }

        return [
            'w.organisation_id = ? AND w.status = "published" AND FIND_IN_SET(?, w.audience) > 0',
            [$user['organisation_id'], self::group($user['role']) ?? '-'],
        ];
    }

    /**
     * @param User $user
     * @return array<string, mixed>
     */
    private function row(array $user, bool $manager, int $id): array
    {
        [$where, $args] = $this->visible($user, $manager);
        $stmt = $this->pdo->prepare(
            'SELECT ' . self::COLUMNS . ' FROM workshop w'
            . ' LEFT JOIN workshop_rsvp r ON r.workshop_id = w.id AND r.user_id = ?'
            . " WHERE w.id = ? AND $where"
        );
        $stmt->execute([$user['id'], $id, ...$args]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    }

    /**
     * The workshop row under a lock, in the user's organisation. Non-managers see only what they may see.
     *
     * @param User $user
     * @return array<string, mixed>
     */
    private function locked(array $user, int $id, bool $manager = true): array
    {
        [$where, $args] = $this->visible($user, $manager);
        $stmt = $this->pdo->prepare("SELECT w.* FROM workshop w WHERE w.id = ? AND $where FOR UPDATE");
        $stmt->execute([$id, ...$args]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : throw new ApiError(404, 'NOT_FOUND', 'Not found.');
    }

    /** @param array<string, mixed> $workshop */
    private function assertOpen(array $workshop, int $now): void
    {
        if ($workshop['status'] === 'cancelled') {
            throw new ApiError(409, 'WORKSHOP_CANCELLED', 'This workshop is cancelled.');
        }
        if ($now >= WorkshopTime::unix((string) $workshop['starts_at'])) {
            throw new ApiError(409, 'WORKSHOP_STARTED', 'This workshop has started. RSVP is closed.');
        }
    }

    private function count(int $id, string $status): int
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM workshop_rsvp WHERE workshop_id = ? AND status = ?');
        $stmt->execute([$id, $status]);

        return (int) $stmt->fetchColumn();
    }

    /** Moves people from the waitlist into free seats, first come first served. Returns how many moved. */
    private function promote(int $id, int $capacity): int
    {
        $free = $capacity - $this->count($id, 'going');
        if ($free <= 0) {
            return 0;
        }
        $stmt = $this->pdo->prepare(
            'UPDATE workshop_rsvp SET status = "going", updated_at = UTC_TIMESTAMP(3)'
            . ' WHERE workshop_id = ? AND status = "waitlist" ORDER BY id LIMIT ' . $free
        );
        $stmt->execute([$id]);

        return $stmt->rowCount();
    }

    /**
     * Checks a schema-valid body and turns it into column values.
     *
     * @param Saved $data
     * @param array<string, mixed>|null $current the stored row when editing
     * @return array{title: string, description: string|null, starts_at: string, ends_at: string, mode: string,
     *     venue: string|null, online_url: string|null, capacity: int, audience: string}
     */
    private function clean(array $data, int $now, ?array $current): array
    {
        $starts = WorkshopTime::toUtc($data['starts_at'], $this->zone, 'starts_at');
        $ends = WorkshopTime::toUtc($data['ends_at'], $this->zone, 'ends_at');
        $startUnix = WorkshopTime::unix($starts);
        $startChanged = $current === null || WorkshopTime::unix((string) $current['starts_at']) !== $startUnix;
        if ($startChanged && $startUnix <= $now) {
            throw ApiError::validation('starts_at', 'The start must be in the future.');
        }
        if (WorkshopTime::unix($ends) <= WorkshopTime::unix($starts)) {
            throw ApiError::validation('ends_at', 'The end must be after the start.');
        }
        $title = trim($data['title']);
        if ($title === '') {
            throw ApiError::validation('title', 'Add a title.');
        }
        $venue = trim((string) ($data['venue'] ?? ''));
        $url = trim((string) ($data['online_url'] ?? ''));
        if ($data['mode'] === 'in_person' && $venue === '') {
            throw ApiError::validation('venue', 'Add the venue.');
        }
        if ($data['mode'] === 'online' && $url === '') {
            throw ApiError::validation('online_url', 'Add the online meeting link.');
        }
        $description = trim((string) ($data['description'] ?? ''));

        return [
            'title' => $title,
            'description' => $description === '' ? null : $description,
            'starts_at' => $starts,
            'ends_at' => $ends,
            'mode' => $data['mode'],
            'venue' => $data['mode'] === 'in_person' ? $venue : null,
            'online_url' => $data['mode'] === 'online' ? $url : null,
            'capacity' => $data['capacity'],
            'audience' => implode(',', array_values(array_unique($data['audience']))),
        ];
    }

    /**
     * What the screens get. The online link goes only to people with a seat and to managers; the check-in code
     * only to managers.
     *
     * @param array<string, mixed> $row
     * @param User $user
     * @return array<string, mixed>
     */
    private function present(array $row, array $user, bool $manager, int $now): array
    {
        $starts = WorkshopTime::unix((string) $row['starts_at']);
        $ends = WorkshopTime::unix((string) $row['ends_at']);
        $audience = explode(',', (string) $row['audience']);
        $going = (int) $row['going_count'];
        $capacity = (int) $row['capacity'];
        $mine = in_array($row['my_status'], ['going', 'waitlist'], true) ? (string) $row['my_status'] : null;
        $group = self::group($user['role']);
        $out = [
            'id' => (int) $row['id'],
            'title' => $row['title'],
            'description' => $row['description'],
            'starts_at' => WorkshopTime::iso((string) $row['starts_at']),
            'ends_at' => WorkshopTime::iso((string) $row['ends_at']),
            'starts_local' => WorkshopTime::local((string) $row['starts_at'], $this->zone),
            'ends_local' => WorkshopTime::local((string) $row['ends_at'], $this->zone),
            'mode' => $row['mode'],
            'venue' => $row['venue'],
            'online_url' => $manager || $mine === 'going' ? $row['online_url'] : null,
            'capacity' => $capacity,
            'audience' => $audience,
            'status' => $row['status'],
            'going_count' => $going,
            'waitlist_count' => (int) $row['waitlist_count'],
            'spots_left' => max(0, $capacity - $going),
            'started' => $now >= $starts,
            'ended' => $now >= $ends,
            'in_audience' => $group !== null && in_array($group, $audience, true),
            'my_rsvp' => $mine === null ? null : [
                'status' => $mine,
                'checked_in' => $row['my_checked_in_at'] !== null,
                'waitlist_position' => $mine === 'waitlist'
                    ? $this->waitlistPosition((int) $row['id'], (int) $row['my_rsvp_id'])
                    : null,
            ],
        ];
        if ($manager) {
            $out['checkin_code'] = $row['checkin_code'];
            $out['checked_in_count'] = (int) $row['checked_in_count'];
        }

        return $out;
    }

    private function waitlistPosition(int $id, int $rsvpId): int
    {
        $stmt = $this->pdo->prepare(
            'SELECT COUNT(*) FROM workshop_rsvp WHERE workshop_id = ? AND status = "waitlist" AND id < ?'
        );
        $stmt->execute([$id, $rsvpId]);

        return (int) $stmt->fetchColumn() + 1;
    }
}
