import { jsx as _jsx } from "react/jsx-runtime";
const space = value => {
  if (!value) return undefined;
  return value === "base" ? "var(--gap)" : value === "gutter" ? "var(--gutter)" : `var(--gap-${value})`;
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
}) => {
  const style = {
    padding: space(padding),
    paddingInline: space(paddingInline),
    paddingBlock: space(paddingBlock),
    flexGrow: grow ? 1 : undefined,
    minWidth: grow ? 0 : undefined
  };
  return _jsx(Tag, {
    className: className,
    style: style,
    id: id,
    "aria-label": label,
    "aria-labelledby": labelledBy,
    children: children
  });
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
}) => {
  const style = {
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
  return _jsx(Tag, {
    className: className,
    style: style,
    id: id,
    "aria-label": label,
    "aria-labelledby": labelledBy,
    children: children
  });
};