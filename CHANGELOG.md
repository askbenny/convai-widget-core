# Changes

## 1.5.1

- The end-of-chat confirmation is modal for the keyboard: Tab and Shift+Tab stay on its buttons, focus returns to the control that opened it, and it stops handling keys as soon as it closes, so Tab and Escape are not swallowed during its exit animation.
- Rich content only renders the component names the widget defines. An inherited name such as `constructor` or `__proto__` now shows the fallback instead of throwing.

## 1.5.0

Brings the widget up to date with the ElevenLabs widget (`@elevenlabs/convai-widget-core` 0.26.0, `@elevenlabs/client` 1.36.1), keeping Ask Benny's managed sessions, branding, orbs and privacy choices.

- New from upstream: file and image upload, agent message attachments, rich content (carousels, product cards, button groups and quick replies), an optional end-of-chat confirmation, a full-page layout, a default size, opening fullscreen on phones, a segmented voice/text toggle, a "new messages" button, typing and thinking indicators, transcripts that follow the agent's speech, audio tag styling, right-to-left text, the concurrency wait-queue status, human takeover typing, and client events dispatched on the host element (`allow-events`).
- Transcript ordering now uses server message order and response IDs. Servers without response IDs keep the 1.4.14 matching, and a text chat still skips only the greeting's own event, so a first answer sent without the greeting keeps its opening and formatting.
- Persistent text sessions (`persistent-session`) and continuing a call after page navigation work with Ask Benny's managed sessions: stored sessions are keyed by the widget's agent id, and every connection is still signed for its agent branch. Both stay opt-in.
- Text chats end after 3 minutes without a message or keystroke (was 10 minutes, the same as the usual maximum duration, so an abandoned chat ran to the limit and was counted that long).
- Kept on purpose: sessions are signed by Ask Benny for the widget's own agent branch; prompt and LLM overrides stay unavailable; the visitor id is a random id stored in the browser, never a device fingerprint; tool statuses stay scoped to their conversation; Safari input-method composition is still respected.

## 1.4.18

- Security: update Preact to 10.29.8, past the JSON VNode injection advisory (GHSA-36hm-qxxp-pg3m, fixed in 10.28.2). Preact is the only runtime dependency that changes.
- Build and test tooling: vite 7.3.7, vitest and @vitest/browser 3.2.7, refreshed development dependencies.
- Releases are built on Node 24 and published with an npm provenance attestation.

## 1.4.17

- Orb shaders only use `smoothstep` with ascending, distinct edges. Reversed edges are undefined in GLSL, so on some GPUs the glass orb's highlights could vanish or render differently. Covers glass, pulse, vortex, blob and classic.
- Pause the orb's render loop while it is off screen or inside a hidden container, and resume when it is visible again.
- Poll conversation volume for the orb only while a conversation is connected; the orb settles when the call ends.

## 1.4.16

- New default orb, "glass": a lit glass sphere with slowly folding liquid inside that swells and speeds up with the conversation's audio. It renders from the configured orb colors and no longer loads the noise texture from ElevenLabs' CDN.
- The orb shader now receives smoothed input and output volume. The previous orb remains available internally as the `classic` style, alongside `halo`, `blob`, `silk`, `vortex` and `pulse`, which can be compared in the dev-only `orb-gallery.html` page.
- Fix an animation loop leak where each orb color change started an additional render loop.

## 1.4.15

- Keep the widget visible on agents that require authentication. When the unsigned widget-config request is refused (401/403), managed embeds (`agent-id` only) fetch one Ask Benny widget session and retry the request once with its conversation signature. Agents without authentication still make a single unsigned request, a host-supplied `signed-url` is never replaced, and non-authentication failures are not retried.

## 1.4.14

- Preserve separate replies around tool calls, match late final responses to their streams, and keep streamed markdown formatting.
- Suppress only the configured greeting event in text sessions; retain the first actual answer when the greeting is interrupted.
- Show the local greeting when a voice-capable agent starts through text; ignore chat stream parts during voice sessions.
- Avoid submitting while an input method is composing text, and keep language menus positioned within CSS container hosts.
- Remove source generation from package installation; version generation remains part of development and builds.
- Preserve the AskBenny managed-session protocol, explicit signed URLs, public attributes, branding, terms flow, and Wix compatibility patch. No SDK or runtime dependency upgrades.
