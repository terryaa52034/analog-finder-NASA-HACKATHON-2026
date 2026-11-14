# Cinematic introduction

The opening is an enhancement of the existing `createMissionIntro` controller,
not a second app or a page navigation. `web/cinematic-intro.js` exports the reusable
Three.js engine; `web/cinematic.css` scopes its full-screen treatment. The retained
Orbit view and all existing application state remain available.

## Timeline (seconds of visible playback)

| Time | Sequence |
| --- | --- |
| 0–2.1 | Lunar dolly and close-up, mapped craters and terminator lighting |
| 2.1–4.4 | Continuous travel and Martian fly-by |
| 4.4–6.7 | Earth approach with clouds and atmospheric rim |
| 6.7–8.5 | Pull back to a shared straight axis |
| 8.5–10.5 | White/cyan beam sweeps through centres; particles, bloom and timed pulses |
| 10.5–12 | Camera follows the connection towards Earth; other bodies and beam fade |
| 12–13.5 | Earth rotation/orbital beacon settles, ready to ease into the orbit briefing |

The scene starts after local texture readiness or a bounded 900 ms wait. Texture
failures retain coloured geometry. The timeline pauses while the tab is hidden.
Skip cinematic and Escape move directly to the orbit briefing. The film also
flows into that briefing automatically; it does not open the dashboard on its own.
There is no Skip Intro control. Reduced motion defaults to
that static briefing instead of auto-playing the journey. No WebGL preserves the
fallback briefing and working application entry buttons.

All centres are on local x: Moon (-5,0,0), Mars (0,0,0), Earth (5,0,0). The beam's
white core shares exactly that axis. Portrait rendering rotates the entire shared
coordinate system so the same straight composition fits vertically; particles
travel close to the core. Artistic sizes, distances and alignment are not astronomy
data. Planet textures and their limits are credited in THIRD_PARTY_NOTICES.md.

The engine uses a continuous piecewise eased camera/look-target timeline without
scene cuts. Render effects use the matching local Three.js r172 modules:
EffectComposer → RenderPass → UnrealBloomPass → OutputPass. Bloom applies to HDR
beam/glow materials; exposure and pulse strength retain surface detail. Mobile
pixel ratio is capped and composer resolution is lower. An additional resolution
reduction engages after sustained slow rendering. Geometry, particles, textures
and light counts are bounded; no external model/physics package is introduced.

## Lifecycle and interface

`createCinematicIntro(host, { onFrame, onComplete, onError })` returns `dispose`,
`enterOrbit`, `zoomToEarth`, `pause`, `resume`, `seek` and a read-only `snapshot`. `sampleCinematic(time, aspect)`
is a pure timeline sampler. Pause/seek support deterministic previews without
changing the product's automatic 13.5-second sequence.

Disposal stops animation and observers, removes event listeners, clears readiness
timers, disposes geometry/materials/maps, bloom targets and shader materials,
composer/output passes and the renderer, loses its temporary WebGL context and
removes its canvas. Late texture responses are disposed. Controller generation
tokens discard stale module completions after skip/replay. Context loss returns to
the fallback briefing. Replay keeps existing Earth/drone results intact.

The cinematic-to-orbit handoff reuses the same renderer, texture maps and scene.
Planet positions, camera and look target ease into the larger orbit composition,
while the headline, LUMA and mission buttons fade in. The app remains behind the
intro's inert lock until the user chooses Explore Earth or a drone mission. That
choice zooms into Earth and releases the intro resources; no page reload occurs.

## Verification

Serve the existing `web/` directory on port 8765. With Playwright installed, run
`node analog-finder/cinematic-check.cjs` from the parent workspace (optionally set
`PLAYWRIGHT_MODULE` to an absolute installed module path). It checks the live
timeline/handoff, exact axis, camera continuity, skip/replay, retained Orbit view,
mobile framing, retained results and canvas cleanup. Paused preview screenshots
avoid readback stalls changing a timed journey on a software-rendered test browser.
The existing design, layout, map, places and drone checks remain applicable.
