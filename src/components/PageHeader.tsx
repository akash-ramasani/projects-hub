import React from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <>
      <div className="sm:flex sm:items-start sm:justify-between mb-6 gap-4">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-2 text-sm text-gray-700">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-4 sm:mt-0 shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mb-6">{children}</div>}
    </>
  );
}
