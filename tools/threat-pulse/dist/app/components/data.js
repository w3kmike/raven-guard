import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */
// Intended use: the data table that gives each chart its accessible equivalent, folded behind a disclosure so sighted readers can open it and screen readers always reach it.
import { useId, useState } from "react";
export const DataTable = ({
  caption,
  columns,
  rows,
  rowKey,
  showLabel,
  hideLabel
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return _jsxs("div", {
    className: "data-table",
    children: [_jsx("button", {
      type: "button",
      className: "text-button data-table-toggle",
      "aria-expanded": open,
      "aria-controls": id,
      onClick: () => setOpen(!open),
      children: open ? hideLabel : showLabel
    }), _jsx("div", {
      id: id,
      className: open ? "data-table-scroll" : "visually-hidden",
      children: _jsxs("table", {
        children: [_jsx("caption", {
          children: caption
        }), _jsx("thead", {
          children: _jsx("tr", {
            children: columns.map(column => _jsx("th", {
              scope: "col",
              "data-numeric": column.numeric || undefined,
              children: column.label
            }, column.key))
          })
        }), _jsx("tbody", {
          children: rows.map(row => _jsx("tr", {
            children: columns.map(column => _jsx("td", {
              "data-numeric": column.numeric || undefined,
              children: column.cell(row)
            }, column.key))
          }, rowKey(row)))
        })]
      })
    })]
  });
};