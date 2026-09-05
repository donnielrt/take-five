# FIVE

*Piece One* — a real-time visual study in the number five.

A synthesized audiovisual homage to Dave Brubeck & Paul Desmond's *Take Five*.
Invented in its spirit, not transcribed from it. 5/4 time. Key of Bb. ~48 seconds.

---

## Artist statement

I built **FIVE** to try to understand *why* Take Five feels the way it does — and then
say that feeling back in its own voice. The whole work rests on one idea: **make the
meter visible.**

Take Five is written in 5/4, which means every bar has five beats instead of four. Most
people feel that oddness in their body before they can name it: a lilt that never quite
settles into the four-beat sway we're used to. FIVE's job is to turn that feeling into
something you can look at.

At the center of the screen is **"now."** Everything radiates outward from the present
moment. A five-armed mandala counts **1–2–3–4–5** on every bar, so you watch the
impossible count happen again and again until it starts to feel natural. The sax melody
paints a spiral in which *height is pitch* — high notes reach outward, low notes curl home.
Color is harmony: **cool blue when the music is at rest, warm gold in the brief moments of
tension** before it resolves. The bass beats near the core like a heartbeat; haze drifts
through everything like a late-night lounge.

It's short on purpose — one continuous statement with a beginning, a middle, and an end:
a count-in, a head, a solo that builds, a flourish that ignites, and a resolve that fades to black.

---

## How to read it (no music background needed)

| What you see | What it is | What it means |
| --- | --- | --- |
| **Five-armed shape** counting around a pentagon | The 5/4 meter | One arm lights up per beat, so the bar literally counts 1→5. This is the piece's whole point: seeing "five" instead of the "four" you're used to. |
| **Glowing spiral / ribbon** with a bright head dot | The sax melody | Each note is a point; **higher pitch = farther from center**. New notes step around and fade over ~5s, so the line's shape *is* the melody — watch it climb for a high phrase, curl in for a descent. |
| **Color** (mostly blue, flashing gold) | The harmony / tension | Cool blue = "at home." When the chord hits the **dominant** (the pull that needs resolving) it turns **gold**, then relaxes back to blue. Gold = tension, blue = resolved. |
| **Small rings pulsing near the center** | The walking bass | Each bass note emits a ring sized by its pitch. It's the innermost, most rhythmic layer — the pulse you ride on. |
| **Central glow that pulses** + faint expanding rings | The beat & bar changes | A heartbeat on each beat (with extra emphasis so you feel the odd 2-then-3 push), plus a soft bloom at every new chord. Busier music = brighter room. |
| **Drifting smoke** | Atmosphere | Pure mood — a smoky jazz lounge. Not tied to any note. |

**The arc, start to finish:**
1. **Title / count-in** — “FIVE” fades in as five taps establish the meter; the mandala counts 1–2–3–4–5 *before* the music starts.
2. **The head** — the syncopated alto riff and its answer; blue → gold on the dominant → back to blue.
3. **The solo** (two 8-bar loops) — denser, legato; the spiral fills up and winds richer, glow brightens.
4. **The tag** — a rising flourish ends on a big high note, and the whole five-fold star **ignites** — the piece’s single climactic flare.
5. **The resolve** — lands back on the home chord, returns to blue, and fades to black as the reverb rings out.

**Cheat sheet:** press play, and just watch the pentagon count. Notice whenever it turns
gold (tension) and relaxes back to blue (resolved). That's most of the story in one glance.

---

## About the music

This is an **original arrangement** composed in the spirit of the piece — *not* a
transcription of Brubeck's or Desmond's recording or notation. It keeps the identities that
make Take Five feel like itself:

- **5/4 time**, felt as 2 + 3.
- A **syncopated head** statement with its characteristic off-beat pickup.
- The **minor-major-7 "Brubeck" harmony** and its dominant pull.
- A **walking upright bass** (one note per beat, heading for the root).
- A **lyrical, legato alto-sax solo** and a short closing flourish.

The eight-bar harmonic form (looped):
`Bb mMaj7 · Cm9 · Gm9 · F7 · Bbmaj7 · Eb9 · Cm7 · Bb mMaj7`

Everything — melody, bass walk, comping, ride — is **synthesized** by code, so the piece is
reproducible from source and never touches a copyrighted master. Licensing is honored: we
invent and are inspired; we don't copy.

---

## Colophon (how it was made)

One renderer, everywhere. The entire scene is a **pure Canvas-2D function of time** — the
same code draws it live in the browser, in a CPU preview, and frame-by-frame for the video,
so all three are pixel-identical. Browsers GPU-composite Canvas 2D, so the live version still
runs on your graphics card.

The **audio is synthesized two equivalent ways** from one deterministic score, so sound and
picture lock to every note:

- **Browser:** Web Audio API (alto sax, walking bass, Rhodes-style comping, swing ride,
  synthetic reverb room).
- **Video track:** a pure-Node DSP engine with the same instruments and timings.

**Files**

- `index.html` / `style.css` — entry point, stage, chrome & typography
- `js/score.js` — the musical content + per-event timing map (the single source of truth)
- `js/render2d.js` — the Canvas-2D renderer (mandala, melodic spiral, palette, smoke)
- `js/audio.js` — Web Audio synthesis engine (browser, live performance)
- `js/app.js` — driver: modes (live / still / render), UI, render loop
- `tools/render-audio.js` — Node DSP synth → `out_audio.wav`
- `tools/render-video.js` — node-canvas frames piped to ffmpeg, muxed with the audio
- `tools/preview.js` — quick CPU stills for iterating on the look
- `render.sh` — one-shot: synthesize + render + encode `take-five.mp4`

**Deliverables**

- `take-five.mp4` — the finished presentation (1280×720 @30fps, H.264 + AAC, ~49s)
- `index.html` — the interactive, real-time version
- `out_audio.wav` — the standalone music track

**To experience it:** open `index.html` and press Play (real-time), or watch `take-five.mp4`.
Rebuild everything with `./render.sh`.

---

*FIVE, Piece One. Made with a deterministic score, Canvas 2D, and an original synthesized
quartet.*
