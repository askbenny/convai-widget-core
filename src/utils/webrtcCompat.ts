/**
 * Some host pages (notably Wix sites) lock down EventTarget.prototype
 * methods with non-writable, non-configurable property descriptors. The
 * webrtc-adapter shims bundled via @elevenlabs/client overwrite
 * addEventListener/removeEventListener on the WebRTC prototypes by plain
 * assignment at import time; when the inherited property is read-only that
 * assignment throws a TypeError in strict mode, which kills the whole
 * bundle before the widget custom element is ever registered.
 *
 * Defining own writable copies of those methods on the WebRTC prototypes
 * makes the shim assignments succeed regardless of how the host page has
 * locked down EventTarget.prototype. This module must be imported before
 * anything that pulls in @elevenlabs/client.
 */

const EVENT_TARGET_METHODS = ["addEventListener", "removeEventListener", "dispatchEvent"] as const;

const PATCH_TARGETS = [
  "RTCPeerConnection",
  "RTCDataChannel",
  "RTCDtlsTransport",
  "RTCIceTransport",
  "RTCSctpTransport",
  "MediaStreamTrack",
  "MediaStream",
  "MediaDevices",
] as const;

export function ensureWritableEventTargetMethods(
  scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>
) {
  for (const ctorName of PATCH_TARGETS) {
    const ctor = scope[ctorName] as { prototype?: object } | undefined;
    const proto = ctor?.prototype;
    if (!proto) continue;

    for (const method of EVENT_TARGET_METHODS) {
      try {
        if (Object.getOwnPropertyDescriptor(proto, method)) continue;

        // Only needed when an inherited descriptor would block assignment.
        let inherited: PropertyDescriptor | undefined;
        let current: object | null = Object.getPrototypeOf(proto);
        while (current && !inherited) {
          inherited = Object.getOwnPropertyDescriptor(current, method);
          current = Object.getPrototypeOf(current);
        }
        if (!inherited || inherited.writable !== false) continue;

        const value = (proto as Record<string, unknown>)[method];
        if (typeof value !== "function") continue;

        Object.defineProperty(proto, method, {
          value,
          writable: true,
          configurable: true,
          enumerable: false,
        });
      } catch {
        // Best-effort: never let the compat patch itself break loading.
      }
    }
  }
}

ensureWritableEventTargetMethods();
