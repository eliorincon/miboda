"use client";

import { useEffect, useMemo, useState } from "react";

type CountdownProps = {
  target: string;
  /** "compact": versión pequeña sobre fondo verde (tarjeta del invitado) */
  variant?: "default" | "compact";
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

export function Countdown({ target, variant = "default" }: CountdownProps) {
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

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-4 gap-2">
        {entries.map(([label, value]) => (
          <div
            className="rounded-xl border border-[#F7F3EA]/18 bg-[#0C1D0E]/25 px-1 py-2.5 text-center"
            key={label}
          >
            <p className="font-display text-2xl tabular-nums text-[#F7F3EA] sm:text-3xl">
              {typeof value === "number" ? String(value).padStart(2, "0") : "--"}
            </p>
            <p className="mt-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-[#A39F88]">
              {label}
            </p>
          </div>
        ))}
      </div>
    );
  }

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
