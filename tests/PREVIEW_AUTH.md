# PR #3 preview authentication

Use the stable review URL:

https://atlas-git-desktop-progress-usability-hb-16-manoel.vercel.app

## Root cause and fix

`atlasAuthOrigin()` previously canonicalized every non-localhost origin to
production. Both the Google button's `redirectTo` and the successful callback
redirect therefore switched preview users to production. The callback now also
checks proxy host metadata against the same exact allowlist, so an internal Next.js
request hostname cannot replace an authorized preview origin. Untrusted forwarded
hosts and hosted localhost spoofing are rejected. Email/password login
already used a same-origin relative redirect.

The helper now accepts exact HTTPS origins configured in
`NEXT_PUBLIC_ATLAS_PREVIEW_AUTH_ORIGINS`. This variable is set in **Vercel → Atlas →
Settings → Environment Variables**, targeting **Preview**, scoped to branch
`desktop-progress-usability`, with the stable review origin above. Production
configuration and the default canonical production origin are unchanged.

Use this stable alias for review. An immutable deployment hostname or another
preview hostname is not automatically trusted: authorize its exact origin in this
variable and add its callback to Supabase first, then rebuild that deployment.
Do not allow `*.vercel.app` or take a callback origin from a `next` query parameter.

## Supabase redirect allowlist

In **Supabase → Atlas project → Authentication → URL Configuration → Redirect URLs**,
the required Google callback is:

```text
https://atlas-git-desktop-progress-usability-hb-16-manoel.vercel.app/auth/callback
```

If testing confirmation/recovery emails on the preview, also allow these exact URLs:

```text
https://atlas-git-desktop-progress-usability-hb-16-manoel.vercel.app/auth/callback?next=/
https://atlas-git-desktop-progress-usability-hb-16-manoel.vercel.app/auth/callback?next=/auth/update-password
```

Keep **Site URL** as `https://atlas-five-kappa.vercel.app`. Do not remove existing
production or localhost callbacks. Google Cloud's authorized redirect URI remains
`https://ckugrujjnrzdltshbtfk.supabase.co/auth/v1/callback`; no Google client change is needed.

## Verification and limits

A live public Supabase authorize/cancel probe returned to the stable preview
`/auth/callback`, confirming Supabase currently accepts that redirect. No Supabase
allowlist settings were changed. This is not a successful real-account Google login.
The local isolated browser suite verifies password login, PKCE callback exchange,
session restoration, and signed-in Goals against a mock API; real Google account
acceptance on the protected preview still needs the reviewer.
