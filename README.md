# FIVE — a visual interpretation of *Take Five*

An original, real-time audiovisual homage to Dave Brubeck / Paul Desmond's jazz classic
**Take Five**. The number **5** is made *visible*: the whole piece orbits five-fold
radial symmetry, one per beat of its famous **5/4** meter. You literally watch the bar
count — 1 → 2 → 3 → 4 → 5 — bloom open every measure.

This is an **original interpretation**, not a copy of the recording. The music is an
*original performance* synthesized in real time, built around the piece's signature
identities: the syncopated alto-sax head riff, Brubeck's minor–major-7 harmony, a walking
upright bass, and a lyrical Desmond-style solo line — all in 5/4.

> **The wall label:** [`EXPLAINER.md`](./EXPLAINER.md) is the artist statement + how-to-read
> guide for this piece, written by its maker. Read it first if you want to know what every
> color and line means.

---

## The concept

| Musical idea | Visual idea |
| --- | --- |
| **5/4 meter** | A five-armed mandala counts 1→2→3→4→5 every bar — one arm per beat |
| **The sax line** (head + solo) | A glowing melodic spiral; **higher pitch = farther from center**, notes fade over ~5s |
| **Walking bass** | Small pitch-sized rings pulsing near the core — the heartbeat you ride |
| **Chord / harmony** | Color: cool blue at rest, **gold on the dominant** (tension), back to blue on resolve |
| **The beat & bar changes** | A central glow that pulses each beat + a soft bloom on every chord change |
| **Atmosphere** | Drifting lounge haze, tinted by the current chord |

**Atmosphere:** a smoky 1959 lounge — drifting smoke, film grain, soft vignette.

## Structure of the piece (one continuous performance)

1. **Count-in** — five taps establish the 5/4 feel before the music begins.
2. **Head A** — the iconic alto-sax riff over the changes (the recognizable hook).
3. **Head B** — a contrasting phrase, piano + sax trading.
4. **Solo** — a lyrical Desmond-style alto line, the visual centerpiece.
5. **Outro / Tag** — returns to the head motif and resolves on five.

## How to run

### The journey (shareable entry point)

Open `index.html` — the exhibit page: the original (Spotify/YouTube) first, then the
interpretation (video + live + explainer), then the process (thought process, decisions,
and the raw source). This is the page to share.

### Interactive (uses your GPU in the browser)

Open `experience.html` and press **Play**. The scene renders in real time; the canvas is
GPU-composited by your graphics card (RTX 5090 here) and the quartet is synthesized live
via Web Audio.

### Rendered MP4 (finished presentation)

```bash
./render.sh          # synthesize audio (Node DSP) + render frames (node-canvas) -> ffmpeg -> take-five.mp4
```

### Share it (a simple link)

```bash
gh auth login        # once
./publish.sh         # -> https://<you>.github.io/take-five/
```

Or preview locally first: `python3 -m http.server 8000` → <http://localhost:8000>

## Tech

- **One renderer, every place.** The whole scene is a pure Canvas-2D function of time
  (`js/render2d.js`): the same code draws it in the browser, in a CPU preview, and in the
  rendered video — so all three are pixel-identical. Browsers GPU-composite Canvas 2D, so
  it still runs on your graphics card.
- **Original performance, synthesized two ways.** The quartet (alto sax, walking upright
  bass, Rhodes-style comping, swing ride) is generated with the **Web Audio API** in the
  browser and with an equivalent pure-Node DSP engine for the video track — both driven by
  the same deterministic score so audio and visuals lock to every note.
- **Deterministic score.** `js/score.js` encodes the 5/4 meter, the head riff, the
  minor–major-7 changes, the bass walk and a composed solo, plus a per-event timing map.

## Files

- `index.html` / `journey.css` — the shareable journey page (the exhibit)
- `experience.html` / `style.css` — the live, real-time player
- `js/score.js` — musical content + the per-event timing map (beats/notes/chords)
- `js/render2d.js` — the pure Canvas-2D renderer (mandala, melodic spiral, palette, smoke)
- `js/audio.js` — Web Audio synthesis engine (browser, live performance)
- `js/app.js` — driver: modes (live/still/render), UI, render loop
- `take-five.mp4` / `poster.jpg` / `out_audio.wav` — the finished piece, its poster, the track
- `EXPLAINER.md` — the wall label (artist statement + how-to-read + colophon)
- `process/conversation-log.md` — the cleaned "raw log" of how it was made
- `tools/` — `render-audio.js`, `render-video.js`, `preview.js` (build tooling)
- `render.sh` — synthesize audio + render + encode `take-five.mp4`
- `publish.sh` — one-command publish to GitHub Pages (a shareable link)

## A note on homage

This is a tribute *inspired by* Take Five. The arrangement and melody are original
compositions written in the spirit of the piece; they do not reproduce Brubeck's or
Desmond's copyrighted recording or notation.
