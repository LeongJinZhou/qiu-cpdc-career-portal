<?php

declare(strict_types=1);

use Cpdc\Db\Connection;
use Cpdc\Db\Migrator;
use Cpdc\Env;

require __DIR__ . '/../vendor/autoload.php';

Env::load(dirname(__DIR__, 2) . '/.env');

$ran = (new Migrator(Connection::fromEnv(), __DIR__ . '/../migrations'))->run();
echo 'Applied ' . count($ran) . " migration(s)\n";
