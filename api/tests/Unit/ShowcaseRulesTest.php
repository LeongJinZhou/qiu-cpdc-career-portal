<?php

declare(strict_types=1);

namespace Cpdc\Tests\Unit;

use Cpdc\Http\ApiError;
use Cpdc\Http\UploadedFile;
use Cpdc\Logbook\Mail\PhpMailMailer;
use Cpdc\Logbook\ReviewLink;
use Cpdc\Showcase\ImageCheck;
use Cpdc\Showcase\ShowcaseService;
use PHPUnit\Framework\TestCase;

/** Input rules of slice 2a that need no database: tags, links, image checks, review link secrets, mail subjects. */
final class ShowcaseRulesTest extends TestCase
{
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/'
        . 'iZk9HQAAAABJRU5ErkJggg==';

    public function testTagsAreTrimmedAndDeduplicatedIgnoringCase(): void
    {
        $this->assertSame(['React Native', 'SQL'], ShowcaseService::tags([' React   Native', 'SQL', 'sql', '  ']));
    }

    public function testOnlyFullHttpsLinksAreKept(): void
    {
        $this->assertNull(ShowcaseService::httpsUrl('repo_url', '  '));
        $url = 'https://fake.example/x?y=1';
        $this->assertSame($url, ShowcaseService::httpsUrl('repo_url', $url));
        $badUrls = ['http://fake.example', 'ftp://fake.example', 'https://', 'fake.example',
            'https://a:b@fake.example'];
        foreach ($badUrls as $bad) {
            try {
                ShowcaseService::httpsUrl('demo_url', $bad);
                $this->fail("accepted $bad");
            } catch (ApiError $e) {
                $this->assertSame('demo_url', $e->field);
            }
        }
    }

    private function file(string $bytes, int $error = UPLOAD_ERR_OK): UploadedFile
    {
        $path = (string) tempnam(sys_get_temp_dir(), 'cpdc-img');
        file_put_contents($path, $bytes);

        return new UploadedFile('photo.jpg', $path, strlen($bytes), $error);
    }

    public function testAnImageIsKnownByItsBytesNotItsName(): void
    {
        $type = ImageCheck::check($this->file((string) base64_decode(self::PNG)), 1000);
        $this->assertSame(['image/png', 'png'], [$type['mime'], $type['ext']]);
    }

    public function testNonImagesTooLargeAndMissingFilesAreRefused(): void
    {
        $cases = [
            [$this->file('GIF89a not really'), 415],
            [$this->file('%PDF-1.4'), 415],
            [$this->file((string) base64_decode(self::PNG)), 413, 10],
            [$this->file('', UPLOAD_ERR_INI_SIZE), 413],
            [$this->file('', UPLOAD_ERR_PARTIAL), 400],
            [null, 400],
        ];
        foreach ($cases as $i => $case) {
            try {
                ImageCheck::check($case[0], $case[2] ?? 1000);
                $this->fail("case $i accepted");
            } catch (ApiError $e) {
                $this->assertSame($case[1], $e->status, "case $i");
            }
        }
    }

    public function testStoredNamesAreTheOnlyNamesTurnedIntoPaths(): void
    {
        $name = ImageCheck::storedName('webp');
        $this->assertTrue(ImageCheck::isStoredName($name));
        $this->assertFalse(ImageCheck::isStoredName('../../.env'));
        $this->assertFalse(ImageCheck::isStoredName(str_repeat('a', 32) . '.php'));
    }

    public function testReviewLinkSecretsFitTheRouterAndOnlyTheirHashIsKept(): void
    {
        $link = ReviewLink::create();
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9_-]{43}$/', $link['token']);
        $this->assertSame(hash('sha256', $link['token']), $link['hash']);
        $this->assertNotSame($link['token'], ReviewLink::create()['token']);
        $this->assertSame('https://portal.example/review/abc', ReviewLink::url('https://portal.example/', 'abc'));
    }

    public function testMailSubjectsCannotCarryHeaders(): void
    {
        $this->assertSame('Hi Bcc: x@y.example', PhpMailMailer::oneLine("Hi\r\nBcc: x@y.example\n"));
    }
}
