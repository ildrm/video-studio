# Editor canvas and interactions

Status: proposed • Owner: interaction engineer • Dependencies: [timeline](timeline-model-and-editing-commands.md).

Preview coordinates map normalized project canvas space to viewport using a single invertible transform; drag, zoom and letterboxing must not alter serialized values. Pointer capture and cancel restore initial state; snap indicators and numeric fields allow precise placement. Every transform has keyboard and non-drag controls, labels and visible focus. Respect RTL UI while timeline time proceeds left to right as a media convention, with explicit labels. Inspector changes produce one transaction per committed gesture. Bounds, rotation, crop and safe-area overlays are non-destructive. Limit canvas backing resolution to device budget, schedule redraw per animation frame and dispose textures. Acceptance: pointer/keyboard produce equivalent canonical state and undo returns exact values.
