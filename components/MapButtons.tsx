import { Map, Navigation } from "lucide-react";
import type { Settings } from "@/lib/types";

type MapButtonsProps = {
  settings: Settings;
};

export function MapButtons({ settings }: MapButtonsProps) {
  const destinations = [
    {
      label: "Ceremonia",
      sublabel: "José Miguel Carrera",
      maps: settings.ceremony_google_maps_url,
      waze: settings.ceremony_waze_url,
    },
    {
      label: "Celebración",
      sublabel: "Chacabuco 389, Maipú",
      maps: settings.google_maps_url,
      waze: settings.waze_url,
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 max-w-2xl mx-auto">
      {destinations.map((dest) => (
        <div
          className="ivory-panel rounded-2xl p-5 flex flex-col gap-3"
          key={dest.label}
        >
          <div className="mb-1">
            <p className="font-display text-lg text-[#154D35]">{dest.label}</p>
            <p className="text-xs text-[#837E5E] mt-0.5">{dest.sublabel}</p>
          </div>
          <a
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-[#154D35] px-4 py-3 text-sm font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E]"
            href={dest.maps}
            rel="noreferrer"
            target="_blank"
          >
            <Map size={16} />
            Google Maps
          </a>
          <a
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-[#837E5E]/50 px-4 py-3 text-sm font-semibold text-[#15351f] transition hover:border-[#154D35]/50 hover:bg-[#154D35]/5"
            href={dest.waze}
            rel="noreferrer"
            target="_blank"
            style={{ color: "#15351f" }}
          >
            <Navigation size={16} />
            Waze
          </a>
        </div>
      ))}
    </div>
  );
}
