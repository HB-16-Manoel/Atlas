# Desktop Progress regression

Run with Node.js 24+:

```sh
npm ci
npx playwright install chromium
npm run test:desktop-progress
node --experimental-strip-types --test tests/goalProgress.test.ts tests/authUrls.test.ts
```

The browser test builds Next.js with an isolated local mock API, starts it on ports
3010/3011, and exercises the real UI and repository requests. No real Supabase
accounts or data are used. It replaces the local `.next` build; run a normal build
with your usual environment before using that build for anything else.

Coverage includes same-origin password login, PKCE callback/session initialization,
progressive access to the full Atlas Insight card before Goals, both goal types, create/edit/status, validation and server errors,
revision conflicts during an open edit, milestone completion, task/habit linking,
reload persistence through the API, dialog Tab/Shift+Tab/Escape/Cancel, section
buttons and wheel scrolling, chart filters, and desktop viewport sizes from
1920×1080 down to 960×540 (the CSS viewport equivalent of 200% zoom on 1080p).

This does not replace real Supabase acceptance, physical trackpad testing, or
browser-specific native dropdown and browser-chrome zoom verification.
