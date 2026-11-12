import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: controls: a segmented choice built on native radio buttons, so arrow keys and screen readers work as they do for any radio group, and a quiet text button.
import { useId } from "react";
export const Segmented = ({
  label,
  value,
  options,
  onChange,
  hideLabel
}) => {
  const name = useId();
  return _jsxs("fieldset", {
    className: "segmented",
    children: [_jsx("legend", {
      className: hideLabel ? "visually-hidden" : "segmented-legend",
      children: label
    }), _jsx("div", {
      className: "segmented-track",
      children: options.map(option => _jsxs("label", {
        className: "segmented-option",
        title: option.description,
        children: [_jsx("input", {
          type: "radio",
          name: name,
          value: option.value,
          checked: option.value === value,
          onChange: () => onChange(option.value),
          "aria-label": option.description
        }), _jsx("span", {
          children: option.label
        })]
      }, option.value))
    })]
  });
};
export const TextButton = ({
  children,
  onClick,
  icon,
  label,
  pressed,
  controls,
  expanded
}) => _jsxs("button", {
  type: "button",
  className: "text-button",
  onClick: onClick,
  "aria-label": label,
  "aria-pressed": pressed,
  "aria-controls": controls,
  "aria-expanded": expanded,
  children: [icon, _jsx("span", {
    children: children
  })]
});