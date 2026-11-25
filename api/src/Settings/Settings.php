<?php

declare(strict_types=1);

namespace Cpdc\Settings;

use PDO;

/**
 * Typed, read-only view of one organisation's settings. Load once per request per organisation.
 * Missing keys, NULL values and wrong types throw (fail closed).
 */
final class Settings
{
    /** @param array<string, mixed> $values decoded JSON values; null = not set */
    public function __construct(private readonly array $values)
    {
    }

    public static function load(PDO $pdo, int $organisationId): self
    {
        $stmt = $pdo->prepare('SELECT setting_key, value FROM setting WHERE organisation_id = ?');
        $stmt->execute([$organisationId]);
        $values = [];
        foreach ($stmt->fetchAll(PDO::FETCH_KEY_PAIR) as $key => $json) {
            $values[(string) $key] = $json === null ? null : json_decode((string) $json, true, 64, JSON_THROW_ON_ERROR);
        }

        return new self($values);
    }

    public function int(string $key): int
    {
        $value = $this->get($key);

        return is_int($value) ? $value : throw $this->wrong($key, 'int');
    }

    public function float(string $key): float
    {
        $value = $this->get($key);

        return is_int($value) || is_float($value) ? (float) $value : throw $this->wrong($key, 'float');
    }

    public function string(string $key): string
    {
        $value = $this->get($key);

        return is_string($value) ? $value : throw $this->wrong($key, 'string');
    }

    /** @return list<mixed> */
    public function list(string $key): array
    {
        $value = $this->get($key);

        return is_array($value) && array_is_list($value) ? $value : throw $this->wrong($key, 'list');
    }

    /** @return array<string, mixed> */
    public function map(string $key): array
    {
        $value = $this->get($key);
        if (!is_array($value) || ($value !== [] && array_is_list($value))) {
            throw $this->wrong($key, 'map');
        }

        /** @var array<string, mixed> $value */
        return $value;
    }

    private function get(string $key): mixed
    {
        $value = $this->values[$key] ?? null;
        if ($value === null) {
            throw new \UnexpectedValueException("Setting $key is missing or not set");
        }

        return $value;
    }

    private function wrong(string $key, string $type): \UnexpectedValueException
    {
        return new \UnexpectedValueException("Setting $key is not a $type");
    }
}
