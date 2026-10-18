# PhotoSoap QA checklist

## Phase 1 smoke tests
1. Open index.html in Chrome, Firefox and Safari.
2. Import a portrait image. Verify it fits without distortion or clipping.
3. Create two layers, paint a stroke and erase part of it.
4. Reorder layers and toggle visibility; confirm correct composite.
5. Move a layer; use undo and redo to verify its position.
6. Change brightness, contrast and opacity; confirm exported PNG matches preview.
7. Save a project, reload it and verify layer names, order, offsets and effects.
8. Export JPEG; verify transparent pixels render on white.
9. Resize and crop the canvas; inspect all layers for alignment.
10. Reload the page and accept autosave recovery.
11. Reject an oversized image and malformed project JSON.
12. Test pointer actions on touchscreen and high-DPI display.
13. Verify keyboard shortcuts do not interfere with text entry.
14. Check memory consumption with 30 undo steps and large images.

## Known limitations / defects to address
- No automated tests or browser CI yet.
- Autosave is limited by localStorage quotas and may silently skip large projects.
- Imported images are rasterized to canvas dimensions.
- Rotation, crop, and resize require stronger transform and geometry handling.
- Painting and selection do not yet support full professional-grade workflows.
- No deployment verification.

Do not mark Phase 1 complete until tests have actually been run and failures fixed.
