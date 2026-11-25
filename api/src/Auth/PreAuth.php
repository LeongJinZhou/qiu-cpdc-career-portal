<?php

declare(strict_types=1);

namespace Cpdc\Auth;

use Cpdc\Http\Middleware\Session;
use Cpdc\Http\Request;

/**
 * Short-lived server-side state outside the app session: OAuth state between start and callback, and a LinkedIn
 * identity waiting for a graduate registration. Its own __Host- cookie; it never becomes the app session.
 */
final class PreAuth
{
    public const OAUTH = '__Host-cpdc-oauth';
    public const REGISTRATION = '__Host-cpdc-reg';

    /** @var array<string, int> cookie => lifetime in seconds */
    private const SECONDS = [self::OAUTH => 600, self::REGISTRATION => 1800];

    /**
     * @param array<string, mixed> $data
     * @return string Set-Cookie header value
     */
    public static function put(string $cookie, array $data, int $now): string
    {
        Session::close();
        session_id((string) session_create_id());
        session_start();
        $_SESSION = ['preauth' => ['cookie' => $cookie, 'created_at' => $now] + $data];
        $id = (string) session_id();
        session_write_close();

        return $cookie . '=' . $id . '; Path=/; Max-Age=' . self::SECONDS[$cookie] . '; Secure; HttpOnly; SameSite=Lax';
    }

    /**
     * The data, destroyed on read (single use). Null when missing, expired or not this kind of state.
     *
     * @return array<string, mixed>|null
     */
    public static function take(Request $req, string $cookie, int $now): ?array
    {
        $data = self::read($req, $cookie, $now, true);

        return $data;
    }

    /**
     * The data without using it up (the registration form reads the name to show it).
     *
     * @return array<string, mixed>|null
     */
    public static function peek(Request $req, string $cookie, int $now): ?array
    {
        return self::read($req, $cookie, $now, false);
    }

    /** @return array<string, mixed>|null */
    private static function read(Request $req, string $cookie, int $now, bool $destroy): ?array
    {
        $id = $req->cookies[$cookie] ?? '';
        if (!Session::exists($id)) {
            return null;
        }
        Session::close();
        session_id($id);
        session_start();
        $data = $_SESSION['preauth'] ?? null;
        if (!is_array($data) || ($data['cookie'] ?? null) !== $cookie) {
            session_write_close(); // an app session or another kind: leave it alone

            return null;
        }
        if ($destroy) {
            session_destroy();
        } else {
            session_write_close();
        }
        $fresh = is_int($data['created_at'] ?? null) && $now - $data['created_at'] <= self::SECONDS[$cookie];

        return $fresh ? $data : null;
    }

    public static function expired(string $cookie): string
    {
        return Session::expiredCookie($cookie);
    }
}
