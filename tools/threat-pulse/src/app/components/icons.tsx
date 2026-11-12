/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: each icon Threat Pulse uses, wrapped with one size and stroke so views import icons by meaning and only this file knows they come from Tabler.
import {
  IconAntennaBars5,
  IconArrowLeft,
  IconArrowUpRight,
  IconPin,
  IconPinFilled,
  IconRefresh,
  IconX
} from "@tabler/icons-react";

const props = { size: 16, stroke: 1.75, "aria-hidden": true } as const;

export const FeedsIcon = () => <IconAntennaBars5 {...props} />;
export const BackIcon = () => <IconArrowLeft {...props} />;
export const OutboundIcon = () => <IconArrowUpRight {...props} />;
export const CloseIcon = () => <IconX {...props} />;
export const RefreshIcon = () => <IconRefresh {...props} />;
export const PinIcon = () => <IconPin {...props} />;
export const PinnedIcon = () => <IconPinFilled {...props} />;
