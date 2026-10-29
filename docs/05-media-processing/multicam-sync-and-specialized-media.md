# Multicam sync and specialized media

Status: proposed design; not implemented or tested. Owner: media engineering lead. Dependencies: [canonical model](../03-frontend/canonical-editor-state-and-schema.md), [feature catalog](../01-product/feature-catalog.md), [release gates](../09-delivery/phase-gates-and-definition-of-done.md).

Multicam is a later phase: ingest each camera and recorder separately, use timecode where reliable or propose audio correlation offsets and drift, show confidence and allow manual adjustment. Persist each mapping and a switch list in project time. Avoid implying audio correlation detects lip sync or identifies speakers. Export uses the immutable sources, preserves audio policy independently of angle switches, and validates synchronization at beginning and end.

For 360 video require declared projection and a typed viewport; for interlaced media require detected/confirmed field order and deinterlace mode; image sequences require bounded number, dimensions and expansion of server-assigned assets, never user filesystem globs. Stabilization needs analysis and transform passes and an explicit crop policy. Redaction must be reviewed frame-by-frame for motion; a fixed box is not a privacy guarantee. All specialized paths require fixture tests, limits, availability and cost gates before release.
