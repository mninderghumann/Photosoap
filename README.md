# Photosoap

Free browser-based creative editor combining photo editing and graphic design.

## P0 — Core editor

- [ ] Next.js + TypeScript application shell
- [ ] Responsive canvas workspace with zoom, pan, guides and rulers
- [ ] Import images (PNG, JPEG, WebP) with drag and drop
- [ ] Layer management: add, reorder, hide, lock, rename and delete
- [ ] Selection, move, resize, rotate, crop and transform
- [ ] Text editing: fonts, size, color and alignment
- [ ] Shapes: rectangle, ellipse and line
- [ ] Undo/redo with keyboard shortcuts
- [ ] Export PNG/JPEG/WebP at chosen dimensions
- [ ] Save/load editable project JSON locally
- [ ] Automated smoke tests for import, edit, undo and export

## Implementation principles

Use a non-destructive document model and separate rendering from document state. Prefer client-side editing for privacy and cost. Validate file types and sizes, and do not execute imported SVG or project content. Ship P0 as a tested batch before moving to P1.
