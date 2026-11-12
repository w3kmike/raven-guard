/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: Box and Stack, the layout primitives every view arranges itself with, taking direction, alignment, gap and padding as props drawn from the spacing tokens.
import type { CSSProperties, ElementType, ReactNode } from "react";

export type Space = "hair" | "tight" | "base" | "loose" | "section" | "gutter";

const space = (value: Space | undefined): string | undefined => {
  if (!value) return undefined;
  return value === "base"
    ? "var(--gap)"
    : value === "gutter"
      ? "var(--gutter)"
      : `var(--gap-${value})`;
};

export type BoxProps = {
  as?: ElementType;
  className?: string;
  padding?: Space;
  paddingInline?: Space;
  paddingBlock?: Space;
  grow?: boolean;
  children?: ReactNode;
  id?: string;
  label?: string;
  labelledBy?: string;
};

export const Box = ({
  as: Tag = "div",
  className,
  padding,
  paddingInline,
  paddingBlock,
  grow,
  children,
  id,
  label,
  labelledBy
}: BoxProps) => {
  const style: CSSProperties = {
    padding: space(padding),
    paddingInline: space(paddingInline),
    paddingBlock: space(paddingBlock),
    flexGrow: grow ? 1 : undefined,
    minWidth: grow ? 0 : undefined
  };
  return (
    <Tag
      className={className}
      style={style}
      id={id}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {children}
    </Tag>
  );
};

export type StackProps = BoxProps & {
  direction?: "row" | "column";
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  gap?: Space;
  wrap?: boolean;
};

export const Stack = ({
  as: Tag = "div",
  className,
  direction = "column",
  align,
  justify,
  gap,
  wrap,
  padding,
  paddingInline,
  paddingBlock,
  grow,
  children,
  id,
  label,
  labelledBy
}: StackProps) => {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: direction,
    alignItems: align,
    justifyContent: justify,
    gap: space(gap),
    flexWrap: wrap ? "wrap" : undefined,
    padding: space(padding),
    paddingInline: space(paddingInline),
    paddingBlock: space(paddingBlock),
    flexGrow: grow ? 1 : undefined,
    minWidth: grow ? 0 : undefined
  };
  return (
    <Tag
      className={className}
      style={style}
      id={id}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      {children}
    </Tag>
  );
};
