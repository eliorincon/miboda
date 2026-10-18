import type { ReactNode } from "react";

type SectionProps = {
  eyebrow?: string;
  title: string;
  children: ReactNode;
  id?: string;
};

export function Section({ eyebrow, title, children, id }: SectionProps) {
  return (
    <section id={id} className="container-shell py-12 sm:py-20">
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? (
          <p className="responsive-kicker mb-3 text-xs font-semibold uppercase text-[#A39F88]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-balance font-display text-3xl text-[#F7F3EA] sm:text-5xl">
          {title}
        </h2>
        <div className="gold-line mx-auto my-7 w-44" />
      </div>
      {children}
    </section>
  );
}
