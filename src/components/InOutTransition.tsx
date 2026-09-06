import { HTMLAttributes } from "preact/compat";
import { getSignalish, peekSignalish, Signalish, useSignalish } from "../utils/signalish";
import { useSignal, useSignalEffect } from "@preact/signals";
import { Slot } from "@radix-ui/react-slot";
import { useReducedMotion } from "../utils/useReducedMotion";
import { useCSSTransition } from "../utils/useCssTransition";

interface InOutTransitionProps extends HTMLAttributes<HTMLElement> {
  /**
   * Whether the child should be shown or not.
   */
  active: Signalish<boolean>;
  /**
   * The initial state of the child.
   *
   * @remarks
   * Defaults to the value of `active` at the time of mounting.
   */
  initial?: Signalish<boolean>;
}

/**
 * A wrapper component that retains its children during CSS transitions.
 *
 * @remarks
 * The component expects a single child element. The child will be mounted only
 * when the `active` property is set. When inactive, the component will wait
 * for all ongoing CSS transitions to end and unmount the child afterward.
 *
 * `data-hidden:*` and `data-shown:*` tailwind modifiers can be used to animate
 * the child in and out.
 *
 * @example
 * ```tsx
 * <InOutTransition enabled={enabled}>
 *   <div className="transition-opacity duration-200 data-hidden:opacity-0">
 *     Example
 *   </div>
 * </InOutTransition>
 * ```
 */
export function InOutTransition(props: InOutTransitionProps) {
  const Comp = useReducedMotion().value ? Reduced : Animated;
  return <Comp {...props} />;
}

function Reduced({ active, ...props }: InOutTransitionProps) {
  return getSignalish(active) ? <Slot data-shown={true} {...props} /> : null;
}

function Animated({
  active: activeSignalish,
  initial = activeSignalish,
  ...props
}: InOutTransitionProps) {
  const active = useSignalish(activeSignalish);
  const visible = useSignal(peekSignalish(initial));

  const { handlers, transitioning } = useCSSTransition({
    onEnd: () => {
      visible.value = active.value;
    },
  });

  useSignalEffect(() => {
    if (active.value) {
      visible.value = true;
      return;
    }
    // A rapid dismiss can happen before an entering element is painted. In that
    // case CSS emits no transitionend, so waiting for it would retain the widget
    // forever. Give the browser two frames to start a transition, then clean up
    // immediately if none exists. Real transitions still finish through onEnd.
    let secondFrame: number | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!transitioning.peek()) visible.value = false;
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
    };
  });

  if (!active.value && !visible.value) return null;
  return <Slot data-shown={active.value && visible.value} {...handlers} {...props} />;
}
