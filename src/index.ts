import register from "preact-custom-element";
import { CustomAttributeList } from "./types/attributes";
import { ConvAIWidget } from "./widget";

export type { CustomAttributes } from "./types/attributes";

export function registerWidget(tagName = "askbenny-convai") {
  register(ConvAIWidget, tagName, [...CustomAttributeList], {
    shadow: true,
  });
}
