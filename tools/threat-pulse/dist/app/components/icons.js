import { jsx as _jsx } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: each icon Threat Pulse uses, wrapped with one size and stroke so views import icons by meaning and only this file knows they come from Tabler.
import { IconAntennaBars5, IconArrowLeft, IconArrowUpRight, IconPin, IconPinFilled, IconRefresh, IconX } from "@tabler/icons-react";
const props = {
  size: 16,
  stroke: 1.75,
  "aria-hidden": true
};
export const FeedsIcon = () => _jsx(IconAntennaBars5, {
  ...props
});
export const BackIcon = () => _jsx(IconArrowLeft, {
  ...props
});
export const OutboundIcon = () => _jsx(IconArrowUpRight, {
  ...props
});
export const CloseIcon = () => _jsx(IconX, {
  ...props
});
export const RefreshIcon = () => _jsx(IconRefresh, {
  ...props
});
export const PinIcon = () => _jsx(IconPin, {
  ...props
});
export const PinnedIcon = () => _jsx(IconPinFilled, {
  ...props
});