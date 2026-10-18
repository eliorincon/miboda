import { NextResponse } from "next/server";

export async function POST() {
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        error:
          "MercadoPago aún no está configurado. Agrega MERCADOPAGO_ACCESS_TOKEN para activar esta opción.",
      },
      { status: 501 },
    );
  }

  return NextResponse.json(
    {
      error:
        "Ruta preparada. Falta conectar la creación de preferencias con el SDK/API de MercadoPago.",
    },
    { status: 501 },
  );
}
