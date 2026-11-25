<?php

declare(strict_types=1);

namespace Cpdc\Http;

use Cpdc\Settings\Settings;

/** page / per_page from an already schema-validated query. Over-limit values are rejected, never clamped. */
final class Paginator
{
    // Keeps offset arithmetic far from integer overflow; no real list has this many pages.
    private const MAX_PAGE = 1000000;

    private function __construct(public readonly int $page, public readonly int $perPage)
    {
    }

    /** @param array<mixed> $query */
    public static function fromQuery(array $query, Settings $settings): self
    {
        $page = $query['page'] ?? 1;
        $perPage = $query['per_page'] ?? $settings->int('page_size_default');
        if (!is_int($page) || $page < 1 || $page > self::MAX_PAGE) {
            throw ApiError::validation('page');
        }
        if (!is_int($perPage) || $perPage < 1 || $perPage > $settings->int('page_size_max')) {
            throw ApiError::validation('per_page');
        }

        return new self($page, $perPage);
    }

    public function offset(): int
    {
        return ($this->page - 1) * $this->perPage;
    }

    /**
     * @param list<mixed> $items
     * @return array{items: list<mixed>, page: int, per_page: int, total: int}
     */
    public function envelope(array $items, int $total): array
    {
        return ['items' => $items, 'page' => $this->page, 'per_page' => $this->perPage, 'total' => $total];
    }
}
