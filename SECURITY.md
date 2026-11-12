# Security

This is a static site. There is no server-side code, no database, no user accounts and no cookies.
Forms open the visitor's own mail client; nothing is submitted to a backend.

## Controls

- Content Security Policy on every page: scripts, styles and fonts load only from this origin; no inline scripts or styles; no connections to third parties.
- No third-party resources at all on the main pages. The typeface is self-hosted under `fonts/` (SIL OFL 1.1).
- Referrer policy `strict-origin-when-cross-origin`; outbound links carry `rel="noopener noreferrer"`.
- HTTPS enforced at the host. `_headers` carries the full header set (HSTS, nosniff, frame-ancestors, permissions policy) for hosts that honour it.
- `.well-known/security.txt` gives a reporting contact.

## Known limits

- GitHub Pages cannot send custom response headers, so `frame-ancestors`, HSTS and nosniff apply only when the site moves to a host that reads `_headers`.
- The two demos under `tools/` are third-party MIT apps that load dependencies from esm.sh. They have their own, looser policy and are kept isolated under their own path.

## Reporting

Email security@ravenguardconsulting.com. We reply within five working days.
