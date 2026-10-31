# 7EVEN virtual pilot voice assets

The virtual pilot uses prerecorded human performances only. Browser speech synthesis and AI-generated voice are not used.

## Required primary actor recordings

Place the approved, edited recordings in this directory:

- `primary-en-ng.mp3` — approved English introduction.
- `primary-pcm-ng.mp3` — approved Nigerian Pidgin introduction.

The React player selects the matching recording from the active 7EVEN language setting. Captions remain available if a recording is unavailable.

## Recording and mastering

- Record a real Nigerian voice actor in a quiet treated room.
- Deliver clean, dry voice (no music bed, sound effects, or artificial voice processing).
- Mono, 44.1 kHz or 48 kHz source; export MP3 at 192 kbps or higher.
- Keep integrated loudness consistent between language versions (target approximately -16 LUFS) and true peak at or below -1 dBTP.
- Preserve natural pauses, breath, warmth, and conversational Nigerian delivery.
- The actor must record the approved script; do not use voice cloning or synthetic speech.
- Obtain written performer consent and usage rights covering 7EVEN āprən web, mobile, promotional, and future product use before publishing.

## Character animation handoff

The actual 3D character is a separate deliverable and must be an original, properly licensed rigged GLB. It should include facial controls/visemes for speech, blink shapes, eye movement, and body/idle animation. Do not replace this deliverable with a still image or label the existing SVG illustration as 3D.

The audio player integration is ready for these recordings. Until the approved files are added, playback controls remain unavailable and the script captions are displayed.
