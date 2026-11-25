<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\Http\ApiError;
use PDO;

/**
 * The only place that answers "may this user do X". Permissions come from role_permission for the user's base
 * role plus any extra role in user_role_grant. Deny by default.
 */
final class Access
{
    /** @var array<int, array<string, string>> user id => permission => widest scope, loaded once per request */
    private array $cache = [];

    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @param array{id: int, organisation_id: int, role: string, ...} $user
     * @return array<string, string> permission => scope
     */
    public function permissions(array $user): array
    {
        $id = (int) $user['id'];
        if (isset($this->cache[$id])) {
            return $this->cache[$id];
        }
        $stmt = $this->pdo->prepare(
            'SELECT p.permission, p.scope FROM role_permission p WHERE p.organisation_id = ? AND (p.role = ?'
            . ' OR p.role IN (SELECT g.role_key FROM user_role_grant g WHERE g.user_id = ? AND g.organisation_id = ?))'
        );
        $stmt->execute([$user['organisation_id'], $user['role'], $id, $user['organisation_id']]);
        $rank = ['own' => 1, 'assigned' => 2, 'all' => 3];
        $permissions = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $name = (string) $row['permission'];
            $scope = (string) $row['scope'];
            if (!isset($permissions[$name]) || $rank[$scope] > $rank[$permissions[$name]]) {
                $permissions[$name] = $scope;
            }
        }
        ksort($permissions);

        return $this->cache[$id] = $permissions;
    }

    /** @param array{id: int, organisation_id: int, role: string, ...} $user */
    public function can(array $user, string $permission): bool
    {
        return isset($this->permissions($user)[$permission]);
    }

    /**
     * @param array{id: int, organisation_id: int, role: string, ...} $user
     * @throws ApiError 403 when the user lacks the permission
     */
    public function require(array $user, string $permission): void
    {
        if (!$this->can($user, $permission)) {
            throw new ApiError(403, 'FORBIDDEN', 'You do not have access to this.');
        }
    }
}
