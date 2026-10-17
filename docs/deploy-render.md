# Deploy on Render

The site runs as one Render web service from `render.yaml`. The Starter plan
is needed for the disk that keeps share links and the analysis cache across
restarts.

## First deploy

1. Sign in at render.com with GitHub and allow access to this repo.
2. Click New, then Blueprint, pick the repo, and click Apply.
3. When asked, paste `GEMINI_API_KEY`. Leave the other blank keys empty for now.
4. Wait for the deploy to finish, then open the `onrender.com` link it shows.

## Move billbreaker.org

Do this only once the onrender.com link works.

1. In Render, open the service, then Settings, then Custom Domains. Both
   billbreaker.org and www.billbreaker.org are listed, each with a DNS target.
2. In Cloudflare, open Workers and Pages, then the billbreaker worker, then
   Settings, then Domains and Routes, and remove both custom domains.
3. In Cloudflare DNS for billbreaker.org, add:
   - `CNAME` `@` to the Render target, proxy off (grey cloud)
   - `CNAME` `www` to the Render target, proxy off
4. Back in Render, click Verify on each domain. HTTPS turns on by itself.

To go back, delete the two CNAME records and re-add the worker's custom domains.

## Later

- Model: set `ML_ENDPOINT` to the Hugging Face Space link ending in `/explain`.
- Every push to main redeploys.
