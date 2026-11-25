/**
 * User.avatarUrl holds a photo the user chose: one they uploaded (CUSTOM) or
 * the copy taken when they connected LinkedIn (LINKEDIN). Google's photo lives
 * in googleAvatarUrl as the fallback. Kept apart so a LinkedIn reconnect can
 * refresh its own copy but never replace an upload, and a Google sign-in
 * never clears either.
 */
export function hasOwnPhoto(avatarSource) {
  return avatarSource === 'CUSTOM' || avatarSource === 'LINKEDIN';
}
