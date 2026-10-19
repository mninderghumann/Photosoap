# Photosoap progress tracker

Last reviewed: 2026-10-19

**Status rule:** A task is complete only when code, tests and required checks are verified on the default branch. Unverified work stays pending; do not infer completion from earlier chat messages.

## Progress

| Phase | Scope | Verified done | Total | Status |
|---|---|---:|---:|---|
| P0 | Core editor | 0 | 11 | Verification required |
| P1 | Advanced photo editing | 0 | TBD | Planned |
| P2 | Graphic design and templates | 0 | TBD | Planned |
| P3 | Pro tools and compatibility | 0 | TBD | Planned |
| P4 | Collaboration, performance, launch | 0 | TBD | Planned |

## P0 checklist

- [ ] Next.js + TypeScript application shell
- [ ] Responsive canvas workspace, zoom, pan, guides and rulers
- [ ] PNG/JPEG/WebP import with drag and drop
- [ ] Layer add, reorder, hide, lock, rename and delete
- [ ] Selection, move, resize, rotate, crop and transform
- [ ] Text editing with fonts, size, color and alignment
- [ ] Rectangle, ellipse and line shapes
- [ ] Undo/redo and keyboard shortcuts
- [ ] PNG/JPEG/WebP export with dimensions
- [ ] Local editable project JSON save/load
- [ ] Automated import/edit/undo/export smoke tests

## Update protocol

After each step: (1) implement, (2) run checks, (3) commit, (4) mark its checkbox, (5) recalculate verified completion and record the commit and any blockers. Do not mark an unverified step done.

## Change log

- 2026-10-19: Created tracking baseline. README lists P0 tasks unchecked; implementation completion has not been independently verified.
