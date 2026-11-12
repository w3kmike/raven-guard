/*!
 * Threat Pulse
 * Copyright (c) 2026 Cliff Pyles
 * Released under the MIT License: https://opensource.org/license/mit
 * Original: https://codepen.io/editor/cliffpyles/pen/01a1b748-091b-7303-b14c-0aff50bb8692
 */

// Intended use: the data table that gives each chart its accessible equivalent, folded behind a disclosure so sighted readers can open it and screen readers always reach it.
import { useId, useState, type ReactNode } from "react";

export type Column<R> = {
  key: string;
  label: string;
  numeric?: boolean;
  cell: (row: R) => ReactNode;
};

export type DataTableProps<R> = {
  caption: string;
  columns: readonly Column<R>[];
  rows: readonly R[];
  rowKey: (row: R) => string;
  showLabel: string;
  hideLabel: string;
};

export const DataTable = <R,>({
  caption,
  columns,
  rows,
  rowKey,
  showLabel,
  hideLabel
}: DataTableProps<R>) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="data-table">
      <button
        type="button"
        className="text-button data-table-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? hideLabel : showLabel}
      </button>
      <div id={id} className={open ? "data-table-scroll" : "visually-hidden"}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  data-numeric={column.numeric || undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    data-numeric={column.numeric || undefined}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
