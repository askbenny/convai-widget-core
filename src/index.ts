import "./utils/webrtcCompat";
import { setSourceInfo } from "@elevenlabs/client/internal";
import { PACKAGE_VERSION } from "./version";
import register from "preact-custom-element";
import { CustomAttributeList } from "./types/attributes";
import { ConvAIWidget } from "./widget";
import type { CustomAttributes } from "./types/attributes";
import { h } from "preact";

setSourceInfo({ name: "widget", version: PACKAGE_VERSION });

export type { CustomAttributes } from "./types/attributes";

export function registerWidget(tagName = "askbenny-convai", defaults: CustomAttributes = {}) {
  // Multiple embeds may load the runtime. Never replace an existing element,
  // including a legacy element registered by an older script.
  if (customElements.get(tagName)) return;
  const Component = (attributes: CustomAttributes) => {
    const props = {
      ...defaults,
      ...Object.fromEntries(Object.entries(attributes).filter(([, value]) => value !== undefined)),
    };
    if (tagName === "website-widget" && !props["widget-id"]) return null;
    return h(ConvAIWidget, {
      ...props,
      key: [
        props["widget-id"],
        props["api-base-url"],
        props["portal-hostname"],
        props["widget-id"] ? undefined : props["agent-id"],
      ].join("|"),
    });
  };
  register(
    tagName !== "website-widget" && Object.keys(defaults).length === 0 ? ConvAIWidget : Component,
    tagName,
    [...CustomAttributeList],
    {
      shadow: true,
      mode: "open",
    }
  );
}
