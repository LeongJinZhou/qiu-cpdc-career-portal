<?php

declare(strict_types=1);

namespace Cpdc\Http;

use Opis\JsonSchema\Errors\ValidationError;
use Opis\JsonSchema\Validator as Opis;

/** JSON Schema validation for request bodies and query strings. Schemas must close every object. */
final class Validator
{
    /**
     * @param mixed $data decoded JSON with objects as stdClass (json_decode(..., false))
     * @return array<mixed> the validated data as arrays
     */
    public function validate(string $schemaFile, mixed $data): array
    {
        $schema = json_decode((string) file_get_contents($schemaFile), false, 512, JSON_THROW_ON_ERROR);
        $this->assertClosed($schema, $schemaFile);

        $error = (new Opis())->validate($data, $schema)->error();
        if ($error !== null) {
            throw ApiError::validation($this->field($error));
        }
        if (!is_object($data)) {
            throw ApiError::validation('body'); // only object bodies; a schema must not allow anything else
        }

        return (array) json_decode(json_encode($data, JSON_THROW_ON_ERROR), true);
    }

    /**
     * Query strings are all strings: canonical integers ("0", "12", "-3") become ints for "integer"
     * properties; anything else ("01", "1e3", " 2", "2.0") stays a string and fails the schema.
     *
     * @param array<mixed> $query
     * @return array<mixed>
     */
    public function query(string $schemaFile, array $query): array
    {
        $schema = json_decode((string) file_get_contents($schemaFile), false, 512, JSON_THROW_ON_ERROR);
        $properties = is_object($schema) && isset($schema->properties) && is_object($schema->properties)
            ? $schema->properties : new \stdClass();
        foreach ($query as $name => $value) {
            if (!mb_check_encoding((string) $name, 'UTF-8')) {
                throw ApiError::validation('query');
            }
            if (!is_array($value) && !mb_check_encoding((string) $value, 'UTF-8')) {
                throw ApiError::validation((string) $name);
            }
            $type = $properties->{$name}->type ?? null;
            if ($type === 'integer' && is_string($value) && preg_match('/^(0|-?[1-9]\d{0,17})$/D', $value) === 1) {
                $query[$name] = (int) $value;
            }
        }

        try {
            $data = json_decode(json_encode((object) $query, JSON_THROW_ON_ERROR));
        } catch (\JsonException) {
            throw ApiError::validation('query'); // invalid UTF-8 inside a nested value
        }

        return $this->validate($schemaFile, $data);
    }

    private function assertClosed(mixed $node, string $file): void
    {
        if (is_object($node)) {
            $isObjectSchema = ($node->type ?? null) === 'object' || isset($node->properties);
            if ($isObjectSchema && ($node->additionalProperties ?? null) !== false) {
                throw new \LogicException("Schema $file has an object without additionalProperties: false");
            }
        }
        if (is_object($node) || is_array($node)) {
            foreach ((array) $node as $child) {
                $this->assertClosed($child, $file);
            }
        }
    }

    private function field(ValidationError $error): string
    {
        while ($error->subErrors() !== []) {
            $error = $error->subErrors()[0];
        }
        $path = $error->data()->fullPath();
        $args = $error->args();
        if ($error->keyword() === 'additionalProperties') {
            $path[] = $args['properties'][0] ?? '';
        } elseif ($error->keyword() === 'required') {
            $path[] = $args['missing'][0] ?? '';
        }

        return $path === [] ? 'body' : implode('.', $path);
    }
}
