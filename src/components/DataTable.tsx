import React from "react";

export type DataTableColumn =
  | string
  | { label: string; className?: string; srOnly?: boolean };

interface DataTableProps {
  columns: DataTableColumn[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeight?: string;
  wrapperClassName?: string;
}

function thClass(col: DataTableColumn, index: number, total: number): string {
  const base =
    "whitespace-nowrap py-3.5 text-left text-sm font-semibold text-gray-900";
  if (typeof col !== "string" && col.srOnly) {
    return `${base} relative pl-3 pr-4 sm:pr-6`;
  }
  const extra = typeof col === "string" ? "" : col.className ?? "";
  if (index === 0) return `${base} pl-4 pr-3 sm:pl-6 ${extra}`.trim();
  if (index === total - 1) return `${base} px-3 ${extra}`.trim();
  return `${base} px-3 ${extra}`.trim();
}
function colLabel(c: DataTableColumn) {
  return typeof c === "string" ? c : c.label;
}
function isSrOnly(c: DataTableColumn) {
  return typeof c !== "string" && !!c.srOnly;
}

export function DataTable({
  columns,
  children,
  footer,
  maxHeight = "calc(100vh - 280px)",
  wrapperClassName = "mt-8",
}: DataTableProps) {
  return (
    <div className={`flow-root ${wrapperClassName}`}>
      <div className="overflow-hidden shadow-xs ring-1 ring-black/5 rounded-2xl bg-white flex flex-col">
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full align-middle">
            <div
              className="overflow-y-auto scrollbar-hide relative border-b border-gray-200"
              style={{ maxHeight }}
            >
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-white/80 backdrop-blur-md z-20 sticky top-0 shadow-sm">
                  <tr>
                    {columns.map((col, i) => (
                      <th
                        key={i}
                        scope="col"
                        className={thClass(col, i, columns.length)}
                      >
                        {isSrOnly(col) ? (
                          <span className="sr-only">{colLabel(col)}</span>
                        ) : (
                          colLabel(col)
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {children}
                </tbody>
              </table>
            </div>
            {footer && (
              <div className="border-t border-gray-100">{footer}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
