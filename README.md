# Bill Breaker

Free website that lets anyone look up a federal or state bill and get a plain English breakdown of what it does and how it affects them, alongside live news from Congress sourced from AP News. 

## Stack

- Python: FastAPI server, Jinja HTML templates, SQLite (Turso when deployed)
  For the cache, share links and rate limits (`billbreaker/`)
- Notebooks: the model training notebook and a walkthrough of the site's
  pipeline (`notebooks/`)
- Browser: small JavaScript modules for animation (GSAP, Lenis) and the
  interactive bits (`billbreaker/static/js/`), styled with Tailwind

## Run it

```billbreaker.org```

## Layout

```
billbreaker/
  main.py           app setup, error pages
  pages.py          HTML routes
  api/              JSON and streaming endpoints
  services/         bill text, news, AI calls, cache, rate limits
  ml/               section ranking and claims check from the notebook
  templates/        Jinja pages and partials
  static/           CSS, JS modules, images, vendored GSAP and Lenis
notebooks/          model training and the site pipeline
tests/              pytest suite
docs/               abuse monitoring
```

## Pages

- `/` home with headlines, saved bills and search
- `/bill?state=US&number=HR1` the AI breakdown of one bill
- `/b/<slug>` a published share link
- `/admin/ml` how the model ranks and explains a bill
- `/admin/abuse` rate-limit events (needs `ABUSE_ADMIN_TOKEN`)

## Hosting

Vercel (free) with a free Turso database; steps in [docs/deploy-vercel.md](docs/deploy-vercel.md).
