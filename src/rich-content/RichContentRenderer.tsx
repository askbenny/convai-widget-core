import { ComponentChildren } from "preact";
import { useTextContents } from "../contexts/text-contents";
import { ButtonGroupProps, ButtonGroup } from "./ButtonGroup";
import { Carousel, CarouselProps } from "./Carousel";
import { parseButtonGroupProps, parseCarouselProps } from "./validate";

interface RichContentRendererProps {
  component: string;
  props: unknown;
  richContentId?: string;
}

interface RichContentComponentEntry {
  parseProps: (raw: unknown) => unknown | null;
  render: (props: unknown, richContentId?: string) => ComponentChildren;
}

const RICH_CONTENT_COMPONENTS: Record<string, RichContentComponentEntry> = {
  buttons: {
    parseProps: parseButtonGroupProps,
    render: (props, richContentId) => (
      <ButtonGroup {...(props as ButtonGroupProps)} richContentId={richContentId} />
    ),
  },
  carousel: {
    parseProps: parseCarouselProps,
    render: (props, richContentId) => (
      <Carousel {...(props as CarouselProps)} richContentId={richContentId} />
    ),
  },
};

/** The renderer for a component name the agent sent; inherited names such as `constructor` are unknown. */
export function richContentEntry(component: string): RichContentComponentEntry | undefined {
  return Object.prototype.hasOwnProperty.call(RICH_CONTENT_COMPONENTS, component)
    ? RICH_CONTENT_COMPONENTS[component]
    : undefined;
}

export function RichContentRenderer({ component, props, richContentId }: RichContentRendererProps) {
  const entry = richContentEntry(component);
  const parsed = entry?.parseProps(props);
  if (entry && parsed) {
    return entry.render(parsed, richContentId);
  }

  return <RichContentUnavailable />;
}

function RichContentUnavailable() {
  const text = useTextContents();

  return (
    <div className="rounded-bubble border border-base-border bg-base px-3 py-2.5 text-xs text-base-subtle">
      {text.rich_content_unavailable}
    </div>
  );
}
