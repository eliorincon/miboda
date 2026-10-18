import { HomeClient } from "@/components/HomeClient";
import { getGuestByCode, markGuestOpened } from "@/lib/guests";
import { formatWeddingDate, settings } from "@/lib/settings";
import Link from "next/link";

type GuestPageProps = {
  params: Promise<{ code: string }>;
};

export default async function GuestPage({ params }: GuestPageProps) {
  const { code } = await params;

  // Marcar invitación como abierta (idempotente)
  await markGuestOpened(code);

  const guest = await getGuestByCode(code);

  if (!guest) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-12">
        <div className="ivory-panel max-w-lg rounded-[1.5rem] p-8 text-center">
          <h1 className="font-display text-4xl text-[#154D35]">
            No encontramos esta invitación
          </h1>
          <p className="mt-4 leading-7 text-[#15351f]">
            Revisa el enlace recibido o escríbenos directamente para ayudarte con mucho cariño.
          </p>
          <Link
            className="mt-6 inline-flex rounded-full bg-[#154D35] px-6 py-3 text-[#F7F3EA]"
            href="/"
          >
            Volver a la invitación
          </Link>
        </div>
      </main>
    );
  }

  return (
    <HomeClient
      dateLabel={formatWeddingDate()}
      guest={guest}
      settings={settings}
    />
  );
}
