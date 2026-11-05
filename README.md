# i12e home

A temporary static landing page for European digital infrastructure. Open
`index.html` or serve this directory with any static HTTP server. No installation
or build step is required.

Typography, colours, appearance scripts, fonts, and the animated logotype are
loaded from the same published sources as the plan site. No copies are stored in
this project. The logo uses variant 6 with its default full looping animation;
the shared SVG handles reduced motion. Appearance choices use the
`i12e.home.appearance` storage key.

## Asset caching and logo embedding

The homepage stylesheet URL includes a content fingerprint so new HTML cannot
reuse an older cached layout. After editing `styles.css`, update and check it:

```sh
python3 scripts/version_styles.py
python3 scripts/version_styles.py --check
```

This is a maintenance check, not a site build step. The page remains plain HTML
and CSS, and the stylesheet is stored only once.

The shared logotype is a scripted SVG document. Its animation and appearance
messages require a document embed; an `<img>` would disable its JavaScript. The
iframe reuses the canonical artwork, and the parent supplies its accessible
name. The shared loading style uses opacity while the SVG validates font metrics
before reporting its intrinsic size. It retains a static fallback if valid
measurements are not yet available.

When changing shared design assets, publish and verify those assets **before**
publishing homepage HTML that references their new versions. The typography and
SVG `v` values are the first 12 characters of each file's SHA-256 hash. This order
prevents the old resource being cached under its new URL. Publish HTML and its
local stylesheet together; do not remove or rename the canonical CSS or SVG.

## Publishing

The repository is prepared for `https://infrastructure.eu/`. Adding `CNAME` alone
does not enable hosting or change DNS. Pages and domain administration require
authenticated access, which was unavailable during implementation.

1. Publish these files to the `main` branch of `i12e-eu/home`.
2. In [Settings → Pages](https://github.com/i12e-eu/home/settings/pages), select **Deploy from a branch**, **main**, and
   **/ (root)**.
3. Set the custom domain to **infrastructure.eu** before changing DNS.
4. Replace the parking-related apex web records with all four GitHub Pages `A`
   records:

   ```text
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```

   Replace conflicting apex `AAAA` records with the following records, or remove
   the old apex `AAAA` records if IPv6 will not be used:

   ```text
   2606:50c0:8000::153
   2606:50c0:8001::153
   2606:50c0:8002::153
   2606:50c0:8003::153
   ```

5. Enable **Enforce HTTPS** once the certificate is available. Confirm that
   `https://infrastructure.eu/` serves the landing page successfully.

Preserve unrelated records, including email and verification records. See
[GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## Secondary domain

GitHub Pages supports one custom apex domain per site, so `i12e.eu` needs an
external HTTP redirect. Configure this only after the primary address works.
If forwarding cannot be configured, use `infrastructure.eu` alone.

For the existing Cloudflare-managed `i12e.eu` zone:

1.
Follow [Cloudflare's redirect-domain setup](https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/)
to route the apex through Cloudflare using a proxied `A` record at `192.0.2.1`.
Replace the existing apex web records; retain the `plan` and `design`
subdomains and all unrelated records.
2. Add a Redirect Rule matching only `(http.host eq "i12e.eu")`.
3. Use dynamic target
   `concat("https://infrastructure.eu", http.request.uri.path)`, status **301**,
   and **Preserve query string**.
4. Verify both HTTP and HTTPS requests redirect correctly without a loop. For
   example, `/example?source=check` must redirect to
   `https://infrastructure.eu/example?source=check`.

See [GitHub's domain constraints](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages).

## Validation

Preview homepage and shared-design changes together, using separate origins for
the parent and SVG as in production. Check a complete animation loop, initial
loading and repeated reloads, appearance changes, reduced-motion rendering, and
320px layout. Verify that the logo reports nonzero text metrics and keeps its
full animation canvas, and run the stylesheet version check above.

After publication, verify the exact versioned URLs from `index.html` against the
released files. A successful local preview does not verify the deployed cache.
