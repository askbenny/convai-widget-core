import { clsx } from "clsx";
import { useCallback } from "preact/compat";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ModeToggle } from "../components/ModeToggle";
import { InOutTransition } from "../components/InOutTransition";
import { useTextContents } from "../contexts/text-contents";
import { useModePreference } from "../contexts/mode-preference";
import { useConversation } from "../contexts/conversation";
import { SheetLanguageSelect } from "./SheetLanguageSelect";
import { StatusLabel } from "./StatusLabel";

interface SheetHeaderProps {
  showBackButton: boolean;
  onBackClick?: () => void;
  showStatusLabel: boolean;
  showShadow: boolean;
  showLanguageSelector: boolean;
}

export function SheetHeader({
  showBackButton,
  onBackClick,
  showStatusLabel,
  showShadow,
  showLanguageSelector,
}: SheetHeaderProps) {
  const text = useTextContents();
  const { preferTextOnly, setPreferTextOnly, supportsModeSwitching } =
    useModePreference();
  const { isDisconnected } = useConversation();

  const handleModeToggle = useCallback(
    (textOnly: boolean) => {
      setPreferTextOnly(textOnly);
    },
    [setPreferTextOnly]
  );

  // Only show mode toggle when disconnected and widget supports both modes
  const showModeToggle = supportsModeSwitching && isDisconnected.value;

  return (
    <div
      className={clsx(
        "bg-base shrink-0 relative",
        showShadow && "shadow-header"
      )}
    >
      <div className="flex gap-2 p-4 items-start">
        {showBackButton ? (
          <Button
            variant="ghost"
            onClick={onBackClick}
            aria-label={text.go_back}
            className="!h-8 !w-8"
          >
            <Icon name="chevron-up" className="-rotate-90" size="sm" />
          </Button>
        ) : (
          <div className="relative w-8 h-8" />
        )}
        <InOutTransition active={showStatusLabel}>
          <StatusLabel className="transition-opacity data-hidden:opacity-0" />
        </InOutTransition>
      </div>
      <InOutTransition active={showLanguageSelector || showModeToggle}>
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-center items-center gap-3 transition-[opacity,transform] duration-200 data-hidden:opacity-0 data-hidden:-translate-y-4">
          <InOutTransition active={showModeToggle}>
            <ModeToggle
              isTextOnly={preferTextOnly.value}
              onToggle={handleModeToggle}
              className="transition-opacity data-hidden:opacity-0"
            />
          </InOutTransition>
          <InOutTransition active={showLanguageSelector}>
            <SheetLanguageSelect className="transition-opacity data-hidden:opacity-0" />
          </InOutTransition>
        </div>
      </InOutTransition>
    </div>
  );
}
