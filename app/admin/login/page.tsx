"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Contraseña incorrecta. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="ivory-panel w-full max-w-sm rounded-[1.75rem] p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-[#837E5E]/40">
          <Heart className="text-[#154D35]" size={24} strokeWidth={1.4} />
        </div>
        <h1 className="font-display text-3xl text-[#154D35]">Panel privado</h1>
        <p className="mt-1 text-sm text-[#837E5E]">Zequelly & Elio</p>

        <form className="mt-7 text-left" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold text-[#15351f]">
            Contraseña
            <input
              autoFocus
              className="mt-2 w-full rounded-2xl border border-[#837E5E]/30 bg-white px-4 py-3 text-[#15351f] outline-none focus:border-[#154D35]"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="mt-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            className="mt-5 w-full rounded-full bg-[#154D35] py-3.5 font-semibold text-[#F7F3EA] transition hover:bg-[#0C1D0E] disabled:opacity-60"
            disabled={loading || !password}
            type="submit"
          >
            {loading ? "Verificando…" : "Entrar al panel"}
          </button>
        </form>
      </div>
    </main>
  );
}
