# Photosoap release verification checklist

## Automated browser gate
- [x] Phase 6 consolidated PR #56 merged into main (merge commit 7bd6163).
- [x] Pull-request browser smoke workflow passed in Chromium, Firefox, and WebKit (GitHub Actions run 40109440044).
- [ ] Confirm post-merge main-branch browser workflow passes for the release commit.
- [ ] Verify production deployment URL and deployed commit match main.

## Manual desktop and mobile acceptance (not yet verified)
- [ ] Import PNG, JPEG and WebP; verify orientation and aspect ratio.
- [ ] Create, reorder, rename, hide, lock and delete layers; undo and redo.
- [ ] Edit text and shapes; verify transforms survive save/reopen.
- [ ] Test mouse, touch, keyboard, high-DPI and narrow mobile viewport.
- [ ] Export PNG/JPEG/WebP and compare preview to downloaded image.
- [ ] Test autosave recovery after refresh and local-storage quota exhaustion.
- [ ] Test large images, many layers, 30 undo steps and memory use.
- [ ] Confirm errors are visible and no uncaught browser exceptions occur.

## Known limitations and scope
- Session-only captured raster layer sources are **not** persistent Photoshop Smart Objects.
- Local editing assistants are rule-based; no generative AI service is integrated.
- Export profiles cover PNG, JPEG and WebP; PSD, SVG and PDF compatibility are not provided by those profiles.
- Browser CI is necessary but insufficient for production sign-off.
- Production URL, deployment health, accessibility and performance have not been verified in this checklist.

## Release decision
Do not claim a production launch or feature parity with Photoshop/Canva/Photopea until deployment verification and manual acceptance are completed.
