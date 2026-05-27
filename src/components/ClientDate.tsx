"use client";

import { useEffect, useState } from "react";

type DateInput = Date | string | number;

export function ClientDate({
  date,
  format = "datetime",
}: {
  date: DateInput;
  format?: "datetime" | "date" | "long-date" | "weekday";
}) {
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    const d = new Date(date as string | number | Date);
    let str = "";
    if (format === "date") {
      str = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } else if (format === "long-date") {
      str = d.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } else if (format === "weekday") {
      str = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } else {
      str = `${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} at ${d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }
    setFormatted(str);
  }, [date, format]);

  if (!formatted) {
    return <span className="opacity-0">Loading...</span>;
  }
  return <span>{formatted}</span>;
}
