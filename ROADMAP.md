# PhotoSoap — Product Roadmap

PhotoSoap aims to combine an accessible design studio, advanced raster editor, quick photo editing, AI assistance, and collaborative publishing. Build original implementations; do not copy proprietary code or licensed content.

## Current MVP
- Browser-based layer canvas, image import, brush/eraser, text and shapes
- Layer visibility, ordering, duplication, deletion, transforms, brightness/contrast/opacity
- Undo/redo, canvas resizing/cropping, PNG/JPEG exports
- JSON project save/open

## Phase 1: Robust editor foundation (in progress)
- [ ] Fix canvas transform semantics, coordinate consistency, and non-destructive operations
- [ ] Introduce a typed document schema and migration support
- [ ] Add real selection and cropping UI, not prompt-based crop
- [ ] Add unit/integration/browser tests and continuous integration
- [ ] Support autosave, recovery, image orientation, and accessible controls
- [ ] Add zoom/pan with stable pointer mapping and touch support
- [x] Add persistent layer locking (committed; browser QA pending)
- [ ] Add reliable image decoding, safe limits, and large-file memory management

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
The current implementation is a single HTML prototype, not a production-ready Photoshop replacement. Rotations and image imports are limited by the fixed canvas, adjustments are layer properties rather than full adjustment layers, project files use a JSON data-URL format, and history snapshots are memory intensive. The project has not been browser-tested or deployed in this work session.

## Release gate
A phase is complete only after its acceptance tests pass in an actual browser, automated checks run successfully, regression issues are resolved, and changes are reviewed and deployed. Do not claim phase completion from code commits alone.
