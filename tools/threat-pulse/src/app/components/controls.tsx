/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: controls: a segmented choice built on native radio buttons, so arrow keys and screen readers work as they do for any radio group, and a quiet text button.
import { useId, type ReactNode } from "react";

export type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
};

export const Segmented = <T extends string>({
  label,
  value,
  options,
  onChange,
  hideLabel
}: SegmentedProps<T>) => {
  const name = useId();
  return (
    <fieldset className="segmented">
      <legend className={hideLabel ? "visually-hidden" : "segmented-legend"}>
        {label}
      </legend>
      <div className="segmented-track">
        {options.map((option) => (
          <label
            key={option.value}
            className="segmented-option"
            title={option.description}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              aria-label={option.description}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export type TextButtonProps = {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  label?: string;
  pressed?: boolean;
  controls?: string;
  expanded?: boolean;
};

export const TextButton = ({
  children,
  onClick,
  icon,
  label,
  pressed,
  controls,
  expanded
}: TextButtonProps) => (
  <button
    type="button"
    className="text-button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={pressed}
    aria-controls={controls}
    aria-expanded={expanded}
  >
    {icon}
    <span>{children}</span>
  </button>
);
