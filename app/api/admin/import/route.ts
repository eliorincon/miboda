import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { importGuests } from "@/lib/guests";
import { importRowSchema } from "@/lib/validations";

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated()))
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  try {
    const { rows } = await request.json() as { rows: unknown[] };

    if (!Array.isArray(rows) || rows.length === 0)
      return NextResponse.json({ error: "No se enviaron filas." }, { status: 400 });

    const parsed = rows.map((row, i) => {
      const result = importRowSchema.safeParse(row);
      if (!result.success)
        throw new Error(`Fila ${i + 1}: ${result.error.issues[0].message}`);
      return result.data;
    });

    const { created, errors } = await importGuests(parsed);
    return NextResponse.json({ created, errors });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Error al importar." },
      { status: 400 },
    );
  }
}
