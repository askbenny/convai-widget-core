import { Signal, useSignal } from "@preact/signals";
import { ComponentChildren } from "preact";
import { createContext, useMemo } from "preact/compat";
import { useContextSafely } from "../utils/useContextSafely";
import { useWidgetConfig } from "./widget-config";

interface ModePreferenceContextValue {
    preferTextOnly: Signal<boolean>;
    setPreferTextOnly: (value: boolean) => void;
    supportsModeSwitching: boolean;
}

const ModePreferenceContext = createContext<ModePreferenceContextValue | null>(
  null
);

interface ModePreferenceProviderProps {
    children: ComponentChildren;
}

export function ModePreferenceProvider({
  children,
}: ModePreferenceProviderProps) {
  const config = useWidgetConfig();

  // Check if the widget supports both modes
  const supportsModeSwitching =
        config.value.supports_text_only === true && !config.value.text_only;

  // User's preference for text-only mode (defaults to false = voice mode)
  const preferTextOnly = useSignal(false);

  const value = useMemo(
    () => ({
      preferTextOnly,
      setPreferTextOnly: (value: boolean) => {
        preferTextOnly.value = value;
      },
      supportsModeSwitching,
    }),
    [preferTextOnly, supportsModeSwitching]
  );

  return (
    <ModePreferenceContext.Provider value={value}>
      {children}
    </ModePreferenceContext.Provider>
  );
}

export function useModePreference() {
  return useContextSafely(ModePreferenceContext);
}
