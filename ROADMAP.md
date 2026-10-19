# PhotoSoap — Product Roadmap

PhotoSoap aims to combine an accessible design studio, advanced raster editor, quick photo editing, AI assistance, and collaborative publishing. Build original implementations; do not copy proprietary code or licensed content.

## Current MVP
- Browser-based layer canvas, image import, brush/eraser, text and shapes
- Layer visibility, ordering, duplication, deletion, transforms, brightness/contrast/opacity
- Undo/redo, canvas resizing/cropping, PNG/JPEG exports
- JSON project save/open

## Phase 1: Robust editor foundation (release verification pending)
- [ ] Fix canvas transform semantics, coordinate consistency, and non-destructive operations
- [x] Fix pre-change autosave scheduling and atomic layer restoration (cross-browser CI passed)
- [ ] Introduce a typed document schema and migration support
- [x] Add drag-to-select rectangle and crop UI (cross-browser CI passed)
- [x] Add selection resize handles and crop preview/confirmation (cross-browser CI passed)
- [x] Add browser smoke tests and Chromium/Firefox/WebKit GitHub Actions matrix (CI passed)
- [x] Expand automated browser regression coverage and verify CI passes (run 39256059531)
- [x] Add autosave/recovery, EXIF-aware browser decoding, basic accessible controls (orientation 6 tested; full EXIF matrix remains)
- [x] Add zoom/pan and selection pointer mapping; mobile Chromium touch selection/resize tested
- [x] Add persistent layer locking
- [x] Add image decoding, safe pixel/layer budgets, and repeat-import cleanup (cross-browser CI passed)

## Phase 2: Design studio (not started)
- [ ] Artboards and multi-page layouts
- [ ] Editable vector shapes, text, grids, alignment and snapping
- [ ] Licensed or original templates, reusable elements, brand kits
- [ ] SVG/PDF export and design presets

## Phase 3: AI tools (not started)
- [ ] Background and object removal
- [ ] AI-assisted image enhancement, upscaling and generation
- [ ] Clear consent, provenance, content safety and provider-cost limits
- [ ] Async jobs, retries and billing controls

## Phase 4: Professional editing (not started)
- [ ] Masks, selections, adjustment layers, blend modes
- [ ] PSD import/export compatibility test suite
- [ ] Advanced typography, vector paths, smart objects
- [ ] ICC color profiles, high bit-depth processing and RAW support

## Phase 5: Video and collaboration (not started)
- [ ] Timeline, clips, audio, captions, transitions, exports
- [ ] Authentication, sharing, team roles and comments
- [ ] Real-time collaboration and version history

## Phase 6: Launch and scale (not started)
- [ ] Responsive/mobile editor and PWA offline mode
- [ ] Analytics, error tracking, performance budgets
- [ ] Internationalization, accessibility and SEO
- [ ] Subscriptions, AI credits and compliant ad placements

## Important limitations of current MVP
The current implementation is a single HTML prototype, not a production-ready Photoshop replacement. Rotations and image imports are limited by the fixed canvas, adjustments are layer properties rather than full adjustment layers, project files use a JSON data-URL format, and history snapshots are memory intensive. Browser tests pass in Chromium, Firefox and WebKit. Production deployment has not been verified.

## Release gate
A phase is complete only after its acceptance tests pass in an actual browser, automated checks run successfully, regression issues are resolved, and changes are reviewed and deployed. Do not claim phase completion from code commits alone.


## Phase 1 recent implementation log
- [x] Pan-view mode with pointer drag (cross-browser CI passed)
- [x] Zoom width/height scaled consistently to preserve aspect ratio
- [x] Verify desktop panning in Chromium, Firefox and WebKit; mobile pan gesture testing remains

- [x] Fix rectangle selection drag origin, crop pixel alignment, selection-free export and layer rotation geometry
- [ ] Expand rotation and pixel-perfect export assertions

## Phase 1 release checklist (2026-10-19)
- [x] Chromium, Firefox, WebKit automated desktop/mobile smoke and regression suite: [run 39256059531](https://github.com/mninderghumann/Photosoap/actions/runs/39256059531)
- [x] Image import and repeat-import regression, JPEG EXIF orientation 6, invalid document schema, memory budgets
- [x] Chromium real-touch selection and resize gesture
- [ ] Verify production deployment URL and deployed commit (repository has no homepage configured)
- [ ] Manual release QA on actual iOS Safari and Android Chrome devices
- [ ] Finish complete transform semantics, typed schema/migration, non-destructive operation scope; do not describe Phase 1 as fully complete before these gates
