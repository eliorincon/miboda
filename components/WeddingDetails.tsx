import { Church, Gem, Wine } from "lucide-react";
import type { Settings } from "@/lib/types";

type WeddingDetailsProps = {
  settings: Settings;
};

export function WeddingDetails({ settings }: WeddingDetailsProps) {
  const cards = [
    {
      icon: Church,
      title: "Ceremonia",
      lines: [settings.ceremony_place, settings.ceremony_time, settings.ceremony_address],
    },
    {
      icon: Wine,
      title: "Celebración",
      lines: [settings.party_place, settings.party_time, settings.party_address],
    },
    {
      icon: Gem,
      title: "Dress Code",
      lines: ["Elegante Formal"],
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article
          className="ivory-panel botanical rounded-2xl p-5 sm:p-6 flex flex-col items-center text-center"
          key={card.title}
        >
          <card.icon className="mb-5 text-[#837E5E]" size={28} strokeWidth={1.4} />
          <h3 className="font-display text-2xl text-[#154D35]">{card.title}</h3>
          <div className="mt-4 space-y-2 overflow-wrap-anywhere text-sm leading-6 text-[#15351f]">
            {card.lines.map((line) => (
              <p className="capitalize" key={line}>{line}</p>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
