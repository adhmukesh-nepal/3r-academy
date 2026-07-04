# Email + sign-in setup (3R Academy accounts)

How the account sign-in emails are configured, so you can re-do or hand it off later.
Sign-in uses a **one-time code** (OTP) emailed to the user — no passwords, no magic links.

Pieces involved: **Resend** (sends the email) → **Supabase** (auth + SMTP + email templates) →
the app's sign-in modal (`docs/assets/auth.js`).

---

## 1. Resend — the email sending service (free tier)
1. Sign up at **resend.com**.
2. **Add & verify your domain** `mukeshadhikari.com`: Resend gives DNS records (SPF/DKIM) →
   add them in **GoDaddy** DNS (same place as the `3r` CNAME). Wait for "Domain verified".
3. **Create an API key:** Resend → **API Keys** → **Create API Key** → name it `3R Academy Supabase`,
   permission **Sending access** → **copy the `re_…` key once** and store it privately.

## 2. Supabase — point auth email at Resend (Custom SMTP)
Supabase → **Authentication → Emails → SMTP Settings** → enable **Custom SMTP**:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your `re_…` Resend API key |
| Sender email | `noreply@mukeshadhikari.com` (must be on the verified domain) |
| Sender name | `3R Academy` |

Save. (Built-in Supabase email works for light testing but is rate-limited and spam-prone —
use Resend for real students.)

## 3. Supabase — send a CODE, not a link (email templates)
Supabase → **Authentication → Emails → Templates**. Edit **BOTH** of these templates
(new signups use *Confirm signup*; returning users use *Magic Link*):

Set each body to — and make sure `{{ .ConfirmationURL }}` is **removed** so no link is sent:

```html
<h2>Your 3R Academy sign-in code</h2>
<p>Enter this code to sign in:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>This code expires in 1 hour. If you didn't request it, you can ignore this email.</p>
```

`{{ .Token }}` is the numeric code. If the email still shows a link, the template still
contains `{{ .ConfirmationURL }}`.

## 4. Code length (optional)
The project currently issues **8-digit** codes; the app accepts any length. To make it a
tidy **6-digit** code, set **Authentication → Providers → Email → Email OTP Length = 6**
(and keep the template wording generic, e.g. "Enter this code").

## 5. Auth URLs (required for sessions/redirects)
Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://3r.mukeshadhikari.com`
- **Redirect URLs:** `https://3r.mukeshadhikari.com/**`

## Test
1. `https://3r.mukeshadhikari.com` → **Sign in** → email → **Email me a code**.
2. Email arrives from `noreply@mukeshadhikari.com` with a code → type it → **Verify & sign in**.
3. Unlock a book with its code, then sign in with the same email on another device → the book
   is unlocked and progress is synced.

## Troubleshooting
- **Email shows a link, not a code** → a template still has `{{ .ConfirmationURL }}`; edit BOTH
  *Confirm signup* and *Magic Link* (§3).
- **"Email link is invalid or has expired" / redirected to localhost:3000** → Site URL / Redirect
  URLs not set to the production domain (§5). Request a fresh code after fixing.
- **Code longer than the box allowed** → app now accepts up to 10 chars; or set OTP length to 6 (§4).
- **No email arrives** → check Resend dashboard (Logs), verify SMTP creds in Supabase, check spam.
- **Rate-limited** → that's the built-in email; make sure Custom SMTP (Resend) is enabled (§2).

## Secrets — keep private (never commit)
- Resend **API key** (`re_…`), Supabase **secret key** (`sb_secret_…`), SMTP password.
- These are NOT in this repo and must not be. The only public key in the app is the Supabase
  **publishable** key in `docs/assets/config.js` (safe by design).
