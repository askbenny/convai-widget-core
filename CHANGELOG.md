# Changes

## 1.4.15

- Keep the widget visible on agents that require authentication. When the unsigned widget-config request is refused (401/403), managed embeds (`agent-id` only) fetch one Ask Benny widget session and retry the request once with its conversation signature. Agents without authentication still make a single unsigned request, a host-supplied `signed-url` is never replaced, and non-authentication failures are not retried.

## 1.4.14

- Preserve separate replies around tool calls, match late final responses to their streams, and keep streamed markdown formatting.
- Suppress only the configured greeting event in text sessions; retain the first actual answer when the greeting is interrupted.
- Show the local greeting when a voice-capable agent starts through text; ignore chat stream parts during voice sessions.
- Avoid submitting while an input method is composing text, and keep language menus positioned within CSS container hosts.
- Remove source generation from package installation; version generation remains part of development and builds.
- Preserve the AskBenny managed-session protocol, explicit signed URLs, public attributes, branding, terms flow, and Wix compatibility patch. No SDK or runtime dependency upgrades.
