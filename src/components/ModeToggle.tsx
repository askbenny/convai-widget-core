import { clsx } from "clsx";
import { useCallback } from "preact/compat";
import { Icon } from "./Icon";

interface ModeToggleProps {
  isTextOnly: boolean;
  onToggle: (textOnly: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ModeToggle({
  isTextOnly,
  onToggle,
  disabled = false,
  className,
}: ModeToggleProps) {
  const handleVoiceClick = useCallback(() => {
    if (!disabled) {
      onToggle(false);
    }
  }, [disabled, onToggle]);

  const handleTextClick = useCallback(() => {
    if (!disabled) {
      onToggle(true);
    }
  }, [disabled, onToggle]);

  return (
    <div
      className={clsx(
        "inline-flex items-center rounded-full bg-base-hover p-0.5 gap-0.5",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        onClick={handleVoiceClick}
        disabled={disabled}
        aria-label="Voice mode"
        aria-pressed={!isTextOnly}
        className={clsx(
          "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
          !isTextOnly
            ? "bg-base text-base-primary shadow-sm"
            : "text-base-subtle hover:text-base-primary"
        )}
      >
        <Icon name="volume" size="sm" />
        <span>Voice</span>
      </button>
      <button
        type="button"
        onClick={handleTextClick}
        disabled={disabled}
        aria-label="Text mode"
        aria-pressed={isTextOnly}
        className={clsx(
          "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
          isTextOnly
            ? "bg-base text-base-primary shadow-sm"
            : "text-base-subtle hover:text-base-primary"
        )}
      >
        <Icon name="keyboard" size="sm" />
        <span>Text</span>
      </button>
    </div>
  );
}
