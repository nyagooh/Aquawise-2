# AquaWise Motion Trailer

Code-driven 75-second product trailer for AquaWise's asset-management and non-revenue-water story.

## Commands

- `npm run studio` previews and edits the timeline.
- `npm run audio` regenerates the original ambient score and draft Kenyan-English narration.
- `npm run render` exports the narrated `1920x1080` MP4.
- `npm run render:silent` exports the caption-led silent MP4.
- `npm run poster` exports the final brand frame.
- `npm run typecheck` validates the TypeScript project.

Generated media is written to `out/`. The eight narration clips and ambient score live in `public/audio/` so rendering is deterministic after setup.

The utility, network, metrics, and anomaly are illustrative. Google Maps imagery is not embedded in this composition; if live map footage replaces the illustrative map, preserve Google Maps attribution for the full time it is visible.
