# Revised opt-in sound

The production audio is original additive synthesis: a short two-tone enable confirmation, three related institutional transition timbres, a resolution accent, and short project responses. No music or remote sound files are loaded. The context is created and `resume()` is called synchronously within `enable()`, before its first `await`, following [MDN's gesture guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

`createAudio` exposes `enable`, `off`, `suspend`, `resume`, `cue`, `snapshot`, and `dispose`. Its state callback carries `wanted` (explicit visitor choice), `enabled` (present ability to play), and `state` (`off`, `initializing`, `running`, `suspended`, or `unavailable`). Hidden-tab suspension preserves the choice, clears voices, and never schedules a backlog. Resume after visibility restoration is quiet. Failed opt-in never reports success. Ticket-based cancellation protects enable/mute/enable and visibility races.

The graph uses a master gain of 0.72, soft per-voice attack/decay envelopes, and a compressor at -15 dB threshold, 8:1 ratio, with output trim. Mute releases playing voices over approximately 35 ms and then suspends the context. Already suspended contexts are muted immediately without a redundant delayed state update across the next gesture. Three concurrent cue events are the maximum, with a general cooldown and a longer transition cooldown. Events dropped during fast scrolling are discarded.

## Verification

Eleven unit tests cover synchronous gesture bootstrap, confirmation scheduling, graph connections, distinct timbres, bounded voice duration, cooldowns, mute races, hidden-state cancellation, rejected resume, external interruption, an already-suspended off/on boundary, and unsupported audio.

The reproducible output check runs the exact production graph and cue scheduler in Chromium's `OfflineAudioContext`. With a root server on port 8000:

```sh
PLAYWRIGHT_BROWSERS_PATH=./node_modules/.cache/ms-playwright node tools/black-geometry/capture-audio.mjs
```

Add `--live` to also verify the actual root-served page's primary Sound control and mouse-wheel traversal through the three institutional entries. That check attaches an analyser to the real output graph, without changing its gain or synthesis, and writes `live-interaction.json`.

It writes the nine-second listening sequence and numerical evidence to the ignored `.artifacts/black-geometry/revision-audio/` directory:

- `production-cues.wav`: enable; UChicago transition and settle; Drexel transition and settle; MathWorks transition and settle; both project responses.
- `levels.json`: per-event and complete-buffer peak/RMS values, silence, clipping, and nonfinite samples.

The observed output at 48 kHz had a maximum sample magnitude of 0.3255 (-9.75 dBFS), no clipped or nonfinite samples, and exact initial silence. The enable confirmation peaked at 0.2956 (-10.59 dBFS), with RMS 0.0476 (-26.45 dBFS across its 650 ms measurement window). Institutional transitions had RMS approximately 0.044 (-27.2 dBFS). These measurements establish nonzero output with substantial headroom through the actual graph. They do not measure the user's speaker volume or subjective loudness.

The separate live interaction check passed: the fresh production page had zero contexts and zero oscillator starts; selecting the primary Sound control produced four partials with measured output peak 0.2596. Mouse-wheel traversal through Harper, Drexel, and MathWorks increased the cumulative start count to 8, 12, and 16, respectively, matching a transition and settle cue at each entry. The maximum observed output sample was 0.3183. Muting left the context suspended, zero remaining voices, and both `wanted` and `enabled` false.

Native WebKit rapid-click tracing also found that changing the nested status text during a mouse press could suppress the resulting `click`: six down/up pairs produced only four or five delivered clicks. The Sound button's visual children now use `pointer-events: none`, keeping the native button as the stable hit target. Eight repeated instrumented six-click sequences then delivered all six clicks and finished off/suspended. Keyboard semantics and the native click handler are retained; the rapid-click assertion was not weakened.

**Listening limitation:** the capture was generated and measured, but no claim of human listening is made. A reproducible listening check is to play the WAV at ordinary system volume, then open the root-served site, select Sound, and scroll through UChicago → Drexel → MathWorks; the enable confirmation should be immediate and the normal traversal should produce short, spaced cues. Device speakers, muted system audio, and browser-specific autoplay behavior remain user-device checks.
