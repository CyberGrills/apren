# 7EVEN Virtual Pilot — Original 3D Character Asset Specification

## Purpose

Replace the temporary illustrated SVG pilot with an original, production-ready, rigged 3D concierge. The character must communicate naturally while the approved human voice recordings play. This document is the asset handoff contract for character design, modelling, rigging, animation, audio synchronisation, and web integration.

This is an asset specification only. It does not claim that a 3D model, voice recording, or rig has already been produced.

## Approved character identity

- Character: young Black/African male concierge.
- Skin: rich, dark-brown complexion with realistic, nuanced skin shading; avoid plastic or metallic-looking skin.
- Hair: clean low afro with a precise, sharp hairline.
- Face: thick natural eyebrows, expressive brown eyes, calm and confident direct gaze, approachable expression.
- Wardrobe: tailored 7EVEN uniform in forest green with restrained ivory detailing and a discreet 7 badge.
- Brand palette: preserve the existing forest-green and ivory direction.
- Presentation: cinematic, premium, stylised realism with a warm, personable presence. The design must be original and must not reproduce a copyrighted character or studio-specific model.
- Default framing: waist-up, with a clean silhouette and enough room around the head and shoulders for gestures.

## Required deliverable

- Original, properly licensed `.glb` asset, suitable for web delivery.
- Humanoid skeleton with clean deformation at shoulders, neck, elbows, and wrists.
- Facial rig with named morph targets / blendshapes for speech and expression.
- Separate animation clips or controllable rig channels for idle, listening, speaking, and restrained gestures.
- A short asset manifest documenting mesh names, skeleton root, animation clip names, morph-target names, units, forward axis, and licence/creator attribution.
- Source project files and export settings supplied alongside the GLB so the asset can be maintained.

## Facial rig and speech requirements

The face must support, at minimum:

- `jawOpen`, `mouthClose`, `mouthFunnel`, `mouthPucker`
- `mouthSmileLeft`, `mouthSmileRight`, `mouthFrownLeft`, `mouthFrownRight`
- `mouthUpperUpLeft`, `mouthUpperUpRight`, `mouthLowerDownLeft`, `mouthLowerDownRight`
- `mouthStretchLeft`, `mouthStretchRight`, `mouthPressLeft`, `mouthPressRight`
- `cheekSquintLeft`, `cheekSquintRight`
- `eyeBlinkLeft`, `eyeBlinkRight`
- `eyeLookInLeft`, `eyeLookInRight`, `eyeLookOutLeft`, `eyeLookOutRight`
- `browInnerUp`, `browDownLeft`, `browDownRight`, `browOuterUpLeft`, `browOuterUpRight`

Provide speech visemes compatible with a documented mapping for `sil`, `PP`, `FF`, `TH`, `DD`, `kk`, `CH`, `SS`, `nn`, `RR`, `aa`, `E`, `I`, `O`, and `U`. If the rig uses different internal names, include an explicit mapping in the manifest.

Speech animation must be driven by a time-aligned viseme cue track derived from the final approved actor recording. Do not use a repeating CSS mouth pulse, random jaw movement, or raw audio amplitude as a substitute for phoneme/viseme timing. The English and Nigerian Pidgin recordings need separate cue tracks because their spoken timing differs.

## Required movement and behaviour

1. **Idle:** subtle breathing, natural blink intervals, small eye movements, relaxed posture. Avoid a constant bobbing loop.
2. **Listening:** attentive eye contact, occasional blink, slight head inclination, otherwise still. Do not animate speech.
3. **Speaking:** viseme-driven lip and jaw shapes; subtle cheek and brow participation; occasional natural blink; restrained head movement and small hand gestures.
4. **Transition:** blend smoothly between idle, listening, and speaking. Never snap facial controls or body pose.
5. **Expression:** warm welcome, attentive listening, reassuring confidence, and a natural neutral resting face. Keep expressions subtle and credible.
6. **Accessibility:** provide a reduced-motion mode that disables nonessential movement while preserving readable captions and usable controls.

The pilot must not gesture continuously or move its head on every syllable. Speech movement should follow the actor's phrasing, pauses, and emphasis.

## Audio and performer requirements

- Use professionally recorded human performances only.
- Primary voice: a professionally hired Nigerian actor, with natural Nigerian English and authentic Nigerian Pidgin delivery.
- No browser speech synthesis, AI-generated speech, voice cloning, or synthetic replacement.
- Obtain written performer consent and usage rights for 7EVEN āprən web, mobile, promotional, and future product use before publishing.
- Preserve the approved English and Pidgin scripts unless copy changes are separately approved.
- Generate and review a separate viseme timeline for each final mastered recording. Human review is required to correct alignment around Nigerian English and Pidgin pronunciation, pauses, and connected speech.

## Web integration contract

- Load the GLB only when the pilot scene is mounted or approaching the viewport; dispose of GPU resources when appropriate.
- Prefer compressed geometry and textures (for example, Meshopt/Draco and KTX2 where the export pipeline supports them).
- Keep texture resolution, draw calls, material count, and animation update cost appropriate for mid-range mobile devices.
- Do not block the page's primary hotel discovery or booking interactions while the character loads.
- Keep the existing SVG as a deterministic fallback for WebGL-disabled devices, failed model loads, and reduced-capability environments.
- Respect `prefers-reduced-motion`; captions and voice controls must remain usable without 3D.
- Avoid adding a large rendering dependency until bundle-size and mobile performance have been measured in a preview deployment.
- Do not make external network calls for model assets at runtime unless the asset host and caching policy are explicitly approved.

## Acceptance criteria

- [ ] Character identity and uniform match the approved design direction.
- [ ] GLB loads without console errors on current desktop and mobile browsers.
- [ ] Skeleton deformation is clean during head turns and gestures.
- [ ] Blink, eye-look, brow, cheek, and mouth controls work independently.
- [ ] All required visemes have been demonstrated in both English and Nigerian Pidgin.
- [ ] Mouth shapes follow the actual actor recording timeline, including pauses and silence.
- [ ] Idle, listening, and speaking transitions are smooth and do not overlap incorrectly.
- [ ] Reduced-motion and WebGL fallback paths work.
- [ ] Mobile performance, memory use, loading time, and bundle impact are measured and acceptable.
- [ ] Performer and model usage rights are documented before production release.
- [ ] No fabricated hotel information, booking actions, or payment actions are introduced by the pilot.

## Current implementation status

The production pilot still uses an illustrated SVG with basic blinking and speaking cues. The audio player is wired for the approved English and Pidgin recording paths, but the human actor recordings have not yet been supplied. No rigged GLB or viseme cue tracks are currently part of the confirmed deliverables.

The next implementation phase should begin only when the approved GLB and voice recordings are available, so the integration can be tested against the real rig and real speech rather than guessed mesh names or placeholder timing.
