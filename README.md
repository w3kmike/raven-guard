# Raven Guard Consulting

Marketing site for Raven Guard Consulting: engineering, AI, leadership and security.

Static HTML, CSS and JavaScript. No build step.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Home: hero, four practices, delivery matrix, engagement models, CTA |
| `services.html` | Service lines by practice area |
| `about.html` | Founder, mission, how we staff |
| `contact.html` | Contact form (opens the visitor's mail client) |
| `careers.html` | Jobs board and general application, rendered from `data/jobs.js` |

`tools/` holds the two live security demos linked from the services page (Threat Pulse and Log Explorer, MIT licensed, see the license files inside each).

## Run locally

```bash
./start.sh            # serves on http://localhost:8080 (PORT=9000 ./start.sh for another port)
```

The demos under `tools/` use ES module imports, so they need HTTP rather than `file://`.

## Edit

- Brand tokens and all styling: `css/raven.css`
- Jobs: `data/jobs.js`
- Contact and careers email addresses: `js/raven.js` and `js/careers.js`
- Header and footer are repeated in each HTML file. Change all five together.
