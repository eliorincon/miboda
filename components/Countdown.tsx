"use client";

import { useEffect, useMemo, useState } from "react";

type CountdownProps = {
  target: string;
};

function getTimeParts(target: string) {
  const diff = Math.max(new Date(target).getTime() - Date.now(), 0);
  return {
    días: Math.floor(diff / 86_400_000),
    horas: Math.floor((diff / 3_600_000) % 24),
    minutos: Math.floor((diff / 60_000) % 60),
    segundos: Math.floor((diff / 1000) % 60),
  };
}

export function Countdown({ target }: CountdownProps) {
  const [parts, setParts] = useState<ReturnType<typeof getTimeParts> | null>(null);
  const entries = useMemo(
    () =>
      (["días", "horas", "minutos", "segundos"] as const).map((label) => [
        label,
        parts?.[label],
      ]),
    [parts],
  );

  useEffect(() => {
    const update = () => setParts(getTimeParts(target));
    const initial = window.setTimeout(update, 0);
    const timer = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [target]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {entries.map(([label, value]) => (
        <div className="ivory-panel rounded-2xl p-4 text-center sm:p-5" key={label}>
          <p className="font-display text-3xl text-[#154D35] sm:text-4xl">
            {typeof value === "number" ? String(value).padStart(2, "0") : "--"}
          </p>
          <p className="responsive-kicker mt-2 text-[0.68rem] font-semibold uppercase text-[#837E5E] sm:text-xs">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
