'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, ImagePlus, RotateCcw, Save } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';

function isPhoto(value) {
  return !value || /^https?:\/\/\S+$/i.test(value) || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value);
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'We could not save your account profile.');
  return payload;
}

/** Shared name/photo editor for staff, employer and alumni accounts. */
export default function AccountProfileForm() {
  const [record, setRecord] = useState(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/identity/profile', { cache: 'no-store', credentials: 'include' })
      .then(readJson)
      .then((data) => {
        setRecord(data);
        setName(data.user?.name ?? '');
        setAvatarUrl(data.user?.customAvatarUrl ?? '');
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const choosePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1_000_000) {
      setError('Choose a PNG, JPEG, or WebP image under 1 MB.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => setError('We could not read that image. Try another file.');
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!name.trim()) { setError('Enter your full name.'); return; }
    if (!isPhoto(avatarUrl)) { setError('Choose an image file or enter a full https:// image address.'); return; }
    setSaving(true);
    try {
      const saved = await readJson(await fetch('/api/identity/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), avatarUrl: avatarUrl.trim() }),
      }));
      setRecord((previous) => ({ ...previous, ...saved }));
      setMessage('Saved to your QIU account.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="surface p-6 text-sm text-muted">Loading your account profile…</p>;
  if (error && !record) return <p className="surface p-6 text-sm text-red-700" role="alert">{error}</p>;

  const effectiveAvatar = avatarUrl || record?.user?.avatarUrl || null;
  return (
    <form onSubmit={save} className="surface space-y-5 p-5 sm:p-6">
      <div className="flex items-start gap-4 border-b border-black/10 pb-4">
        <Avatar name={name || record?.user?.name || 'QIU user'} src={effectiveAvatar} size={72} />
        <div>
          <h2 className="font-heading text-lg font-semibold">Your profile</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">This name and photo follow you across event registrations, notifications and the workspace. Your Google photo is used automatically until you choose a custom one.</p>
        </div>
      </div>

      <div>
        <label htmlFor="account-profile-name" className="mb-1 block text-sm font-semibold">Full name</label>
        <input id="account-profile-name" value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-[18px] border border-black/10 bg-black/[0.04] px-4 text-sm focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson" required />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="account-profile-photo" className="secondary-btn min-h-[44px] cursor-pointer justify-center text-sm"><ImagePlus className="h-4 w-4" aria-hidden="true" /> Choose profile photo</label>
        <input id="account-profile-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} className="sr-only" />
        {avatarUrl ? <button type="button" onClick={() => setAvatarUrl('')} className="secondary-btn min-h-[44px] justify-center text-sm"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Use Google photo</button> : null}
      </div>

      {error ? <p className="flex items-start gap-2 text-sm text-red-700" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p> : null}
      {message ? <p className="flex items-start gap-2 text-sm text-emerald-700" role="status"><Check className="mt-0.5 h-4 w-4 shrink-0" />{message}</p> : null}
      <button type="submit" disabled={saving} className="crimson-btn min-h-[46px] justify-center disabled:opacity-60"><Save className="h-4 w-4" aria-hidden="true" />{saving ? 'Saving…' : 'Save profile'}</button>
    </form>
  );
}

