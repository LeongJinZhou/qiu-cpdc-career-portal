<?php

declare(strict_types=1);

namespace Cpdc\Skills;

/**
 * The gap between what a job asks for and a person's own latest rating, per skill area. An area the person never
 * rated counts as level 0, so the whole required level is the gap.
 */
final class Gap
{
    /**
     * @param list<array{area_id: int, name: string, level: int}> $required
     * @param array<int, int> $mine area id => the person's latest level
     * @return array{rows: list<array{area_id: int, name: string, required: int, mine: int|null, gap: int}>,
     *     met: int, total: int}
     */
    public static function compute(array $required, array $mine): array
    {
        $rows = [];
        $met = 0;
        foreach ($required as $need) {
            $own = $mine[$need['area_id']] ?? null;
            $gap = max(0, $need['level'] - ($own ?? 0));
            if ($gap === 0) {
                $met++;
            }
            $rows[] = [
                'area_id' => $need['area_id'],
                'name' => $need['name'],
                'required' => $need['level'],
                'mine' => $own,
                'gap' => $gap,
            ];
        }
        // Biggest gaps first: what to work on.
        usort($rows, static fn (array $a, array $b): int => [$b['gap'], $a['name']] <=> [$a['gap'], $b['name']]);

        return ['rows' => $rows, 'met' => $met, 'total' => count($rows)];
    }
}
