"use client";

import { AnimatePresence, motion } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ClipboardCopy,
  Download,
  Eye,
  EyeOff,
  LogOut,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { getGuestSummary } from "@/lib/guests";
import type { Guest } from "@/lib/types";
import { generateWhatsAppMessage, getInvitationUrl } from "@/lib/utils";
import { type CreateGuestInput, createGuestSchema } from "@/lib/validations";

type Props = { guests: Guest[]; siteUrl: string };

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  declined: "No asistirá",
};
const STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  declined: "bg-red-100 text-red-700",
};

function badge(status: string) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLASS[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── Guest form (create / edit) ───────────────────────────────────────────────
type GuestFormProps = {
  initial?: Guest;
  existingGroups: string[];
  onSave: (data: CreateGuestInput, id?: string) => Promise<void>;
  onClose: () => void;
};
function GuestForm({ initial, existingGroups, onSave, onClose }: GuestFormProps) {
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState("");
  const [membersText, setMembersText] = useState(
    initial?.members?.map((m) => m.name).join("\n") ?? "",
  );

  const form = useForm<CreateGuestInput>({
    resolver: zodResolver(createGuestSchema),
    defaultValues: {
      display_name: initial?.display_name ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      group_name: initial?.group_name ?? "",
      max_guests: initial?.max_guests ?? 1,
    },
  });

  const memberNames = membersText
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean);

  const submit = form.handleSubmit(async (data) => {
    setSaving(true);
    setApiError("");
    try {
      await onSave({ ...data, members: memberNames }, initial?.id);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Error al guardar.");
      setSaving(false);
    }
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="admin-label">
          Nombre visible *
          <input
            className="admin-input mt-1"
            placeholder="Familia Rodríguez"
            {...form.register("display_name")}
          />
          {form.formState.errors.display_name && (
            <span className="mt-1 text-xs text-red-600">
              {form.formState.errors.display_name.message}
            </span>
          )}
        </label>
        <label className="admin-label">
          Grupo *
          <input
            className="admin-input mt-1"
            list="groups-list"
            placeholder="Familia novia"
            {...form.register("group_name")}
          />
          <datalist id="groups-list">
            {existingGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          {form.formState.errors.group_name && (
            <span className="mt-1 text-xs text-red-600">
              {form.formState.errors.group_name.message}
            </span>
          )}
        </label>
        <label className="admin-label">
          Teléfono
          <input
            className="admin-input mt-1"
            placeholder="+56912345678"
            {...form.register("phone")}
          />
        </label>
        <label className="admin-label">
          Email
          <input
            className="admin-input mt-1"
            placeholder="correo@email.com"
            type="email"
            {...form.register("email")}
          />
        </label>
        <label className="admin-label">
          Cupos máximos *
          <input
            className="admin-input mt-1"
            max={20}
            min={1}
            type="number"
            {...form.register("max_guests", { valueAsNumber: true })}
          />
          <span className="mt-1 text-xs text-[#A39F88]">
            Se ajusta solo si listas integrantes abajo.
          </span>
          {form.formState.errors.max_guests && (
            <span className="mt-1 text-xs text-red-600">
              {form.formState.errors.max_guests.message}
            </span>
          )}
        </label>
      </div>

      {/* Integrantes nombrados (uno por línea) */}
      <label className="admin-label">
        Integrantes <span className="font-normal text-[#A39F88]">(uno por línea — cada uno podrá confirmarse por separado)</span>
        <textarea
          className="admin-input mt-1 min-h-24 font-mono text-xs"
          onChange={(e) => setMembersText(e.target.value)}
          placeholder={"José Rojas\nMaría Rojas"}
          value={membersText}
        />
        {memberNames.length > 0 && (
          <span className="mt-1 text-xs text-[#154D35]">
            {memberNames.length} integrante{memberNames.length !== 1 ? "s" : ""} · cupos = {memberNames.length}
          </span>
        )}
      </label>

      {apiError ? (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{apiError}</p>
      ) : null}

      <div className="flex justify-end gap-3 pt-2">
        <button
          className="rounded-full border border-[#837E5E]/30 px-5 py-2.5 text-sm font-semibold text-[#15351f]"
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="rounded-full bg-[#154D35] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={saving}
          type="submit"
        >
          {saving ? "Guardando…" : initial ? "Guardar cambios" : "Crear invitado"}
        </button>
      </div>
    </form>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────
function ImportModal({
  onImport,
  onClose,
}: {
  onImport: (csv: string) => Promise<void>;
  onClose: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);

  const handleImport = async () => {
    setLoading(true);
    try {
      await onImport(csv);
      // result set inside onImport if needed
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-6 text-[#837E5E]">
        Pega el contenido CSV con encabezados en la primera fila. Columnas aceptadas
        (la columna <strong>members</strong> separa los nombres con <code>;</code>):
      </p>
      <code className="rounded-xl bg-[#154D35]/8 px-4 py-3 text-xs text-[#154D35]">
        display_name, phone, email, group_name, max_guests, members
      </code>
      <textarea
        className="admin-input min-h-40 font-mono text-xs"
        onChange={(e) => setCsv(e.target.value)}
        placeholder={'display_name,phone,email,group_name,max_guests,members\nFamilia Rojas,,,Familia novia,2,José Rojas; María Rojas'}
        value={csv}
      />

      {result ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-800">
            ✓ {result.created} invitado{result.created !== 1 ? "s" : ""} importado
            {result.created !== 1 ? "s" : ""}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-red-700">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="flex justify-end gap-3">
        <button
          className="rounded-full border border-[#837E5E]/30 px-5 py-2.5 text-sm font-semibold text-[#15351f]"
          onClick={onClose}
          type="button"
        >
          Cerrar
        </button>
        <button
          className="rounded-full bg-[#154D35] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading || !csv.trim()}
          onClick={handleImport}
          type="button"
        >
          {loading ? "Importando…" : "Importar"}
        </button>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10 backdrop-blur-sm"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      onClick={onClose}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-xl rounded-[1.5rem] bg-[#F7F3EA] p-6 sm:p-8"
        exit={{ y: 12, opacity: 0 }}
        initial={{ y: 12, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-[#154D35]">{title}</h2>
          <button
            className="grid h-9 w-9 place-items-center rounded-full border border-[#837E5E]/30 text-[#837E5E] hover:text-[#15351f]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export function AdminDashboard({ guests: initialGuests, siteUrl }: Props) {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [search, setSearch] = useState("");
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [messageGuest, setMessageGuest] = useState<Guest | null>(null);
  const [msgCopied, setMsgCopied] = useState(false);

  // Derived
  const groups = useMemo(
    () => [...new Set(guests.map((g) => g.group_name))].sort(),
    [guests],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return guests.filter((g) => {
      const matchSearch =
        !q ||
        g.display_name.toLowerCase().includes(q) ||
        g.group_name.toLowerCase().includes(q);
      const matchGroup = filterGroup === "all" || g.group_name === filterGroup;
      const matchStatus = filterStatus === "all" || g.status === filterStatus;
      return matchSearch && matchGroup && matchStatus;
    });
  }, [guests, search, filterGroup, filterStatus]);

  const stats = useMemo(() => getGuestSummary(guests), [guests]);

  // ── API helpers ─────────────────────────────────────────────────────────────
  const refetch = async () => {
    const res = await fetch("/api/admin/guests", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json() as { guests: Guest[] };
      setGuests(data.guests);
    }
  };

  // Al abrir el panel, siempre traer datos frescos (evita HTML cacheado del CDN)
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (data: CreateGuestInput, id?: string) => {
    const url = id ? `/api/admin/guests/${id}` : "/api/admin/guests";
    const method = id ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = await res.json() as { error?: string };
    if (!res.ok) throw new Error(payload.error ?? "Error al guardar.");
    await refetch();
    setCreateOpen(false);
    setEditGuest(null);
  };

  const handleDelete = async (g: Guest) => {
    if (!confirm(`¿Eliminar a "${g.display_name}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`/api/admin/guests/${g.id}`, { method: "DELETE" });
    if (res.ok) await refetch();
  };

  const handleImport = async (csv: string) => {
    // Parse CSV client-side
    const lines = csv.trim().split("\n").map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
    const [header, ...dataRows] = lines;

    if (!header || dataRows.length === 0) throw new Error("CSV vacío o sin datos.");

    const rows = dataRows.map((cols) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => { obj[h.trim()] = cols[i] ?? ""; });
      return obj;
    });

    const res = await fetch("/api/admin/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const result = await res.json() as { created: number; errors: string[] };
    await refetch();
    return result;
  };

  // ── Copy helpers ────────────────────────────────────────────────────────────
  const copyLink = async (g: Guest) => {
    const url = siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/invitado/${g.code}`
      : getInvitationUrl(g.code);
    await navigator.clipboard.writeText(url);
    flash(g.id + "_link");
  };

  const copyWhatsApp = async (g: Guest) => {
    const url = siteUrl
      ? `${siteUrl.replace(/\/$/, "")}/invitado/${g.code}`
      : getInvitationUrl(g.code);
    await navigator.clipboard.writeText(generateWhatsAppMessage(g.display_name, url));
    flash(g.id + "_wa");
  };

  const flash = (key: string) => {
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const logout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    router.push("/admin/login");
  };

  // ── Stats cards ──────────────────────────────────────────────────────────────
  const statCards = [
    { label: "Invitaciones", value: stats.total },
    { label: "Cupos totales", value: stats.totalCupos },
    { label: "Confirmados", value: `${stats.confirmedPeople} personas`, sub: `${stats.confirmed} resp.` },
    { label: "Pendientes", value: stats.pending },
    { label: "No asistirán", value: stats.declined },
    { label: "Han abierto", value: stats.opened },
  ];

  return (
    <main className="min-h-screen bg-[#F5F1E8] px-4 py-8 text-[#15351f]">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#837E5E]">
              Panel de administración
            </p>
            <h1 className="font-display mt-1 text-4xl text-[#154D35]">
              Zequelly & Elio
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="admin-btn-outline flex items-center gap-1.5"
              onClick={() => setImportOpen(true)}
              type="button"
            >
              <Upload size={15} /> Importar CSV
            </button>
            <a
              className="admin-btn-outline flex items-center gap-1.5"
              href="/api/admin/export"
            >
              <Download size={15} /> Exportar CSV
            </a>
            <button
              className="admin-btn-primary flex items-center gap-1.5"
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <Plus size={15} /> Nuevo invitado
            </button>
            <button
              className="admin-btn-outline flex items-center gap-1.5"
              onClick={logout}
              title="Cerrar sesión"
              type="button"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {statCards.map((s) => (
            <div
              className="rounded-2xl border border-[#837E5E]/15 bg-white p-4"
              key={s.label}
            >
              <p className="text-xs text-[#837E5E]">{s.label}</p>
              <p className="font-display mt-1 text-3xl text-[#154D35]">{s.value}</p>
              {s.sub && <p className="text-xs text-[#A39F88]">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-48 flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A39F88]"
              size={15}
            />
            <input
              className="admin-input w-full pl-9"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre o grupo…"
              value={search}
            />
          </div>
          <select
            className="admin-input"
            onChange={(e) => setFilterGroup(e.target.value)}
            value={filterGroup}
          >
            <option value="all">Todos los grupos</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <select
            className="admin-input"
            onChange={(e) => setFilterStatus(e.target.value)}
            value={filterStatus}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="declined">No asistirá</option>
          </select>
          {(search || filterGroup !== "all" || filterStatus !== "all") && (
            <button
              className="admin-btn-outline flex items-center gap-1 text-xs"
              onClick={() => {
                setSearch("");
                setFilterGroup("all");
                setFilterStatus("all");
              }}
              type="button"
            >
              <X size={13} /> Limpiar
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-[#837E5E]/15 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="bg-[#154D35] text-[#F7F3EA]">
                  {[
                    "Nombre",
                    "Grupo",
                    "Estado",
                    "Cupos",
                    "Invitación",
                    "Personas / mensaje",
                    "Acciones",
                  ].map((h) => (
                    <th className="px-4 py-3.5 font-semibold" key={h}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#837E5E]/10">
                {filtered.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-[#A39F88]" colSpan={7}>
                      No se encontraron invitados con esos filtros.
                    </td>
                  </tr>
                ) : (
                  filtered.map((g) => (
                    <tr className="hover:bg-[#F7F3EA]/60" key={g.id}>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold">{g.display_name}</p>
                        {g.phone && (
                          <p className="text-xs text-[#A39F88]">{g.phone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[#837E5E]">{g.group_name}</td>
                      <td className="px-4 py-3.5">{badge(g.status)}</td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold">{g.confirmed_count}</span>
                        <span className="text-[#A39F88]">/{g.max_guests}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        {g.has_opened_invitation ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">
                            <Eye size={11} /> Abierta
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                            <EyeOff size={11} /> No abierta
                          </span>
                        )}
                      </td>
                      <td className="max-w-[230px] px-4 py-3.5">
                        {g.members && g.members.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {g.members.map((m, i) => (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  m.confirmed
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-gray-100 text-gray-500"
                                }`}
                                key={`${m.name}-${i}`}
                              >
                                {m.confirmed ? (
                                  <Check size={10} strokeWidth={3} />
                                ) : (
                                  <X size={10} strokeWidth={3} />
                                )}
                                {m.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-[#A39F88]">—</span>
                        )}
                        {g.message && (
                          <button
                            className="mt-1 flex w-full items-start gap-1 text-left"
                            onClick={() => {
                              setMessageGuest(g);
                              setMsgCopied(false);
                            }}
                            title="Ver mensaje completo"
                            type="button"
                          >
                            <MessageSquareText
                              className="mt-0.5 flex-shrink-0 text-[#154D35]"
                              size={12}
                            />
                            <span className="line-clamp-2 text-xs italic text-[#837E5E] underline decoration-dotted underline-offset-2 hover:text-[#154D35]">
                              "{g.message}"
                            </span>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {/* Copy link */}
                          <button
                            className="admin-icon-btn"
                            onClick={() => copyLink(g)}
                            title="Copiar link personalizado"
                            type="button"
                          >
                            {copiedId === g.id + "_link" ? (
                              <Check size={15} className="text-emerald-600" />
                            ) : (
                              <ClipboardCopy size={15} />
                            )}
                          </button>
                          {/* Copy WhatsApp */}
                          <button
                            className="admin-icon-btn"
                            onClick={() => copyWhatsApp(g)}
                            title="Copiar mensaje de WhatsApp"
                            type="button"
                          >
                            {copiedId === g.id + "_wa" ? (
                              <Check size={15} className="text-emerald-600" />
                            ) : (
                              <MessageCircle size={15} />
                            )}
                          </button>
                          {/* Edit */}
                          <button
                            className="admin-icon-btn"
                            onClick={() => setEditGuest(g)}
                            title="Editar invitado"
                            type="button"
                          >
                            <Pencil size={15} />
                          </button>
                          {/* Delete */}
                          <button
                            className="admin-icon-btn text-red-400 hover:text-red-600"
                            onClick={() => handleDelete(g)}
                            title="Eliminar invitado"
                            type="button"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#837E5E]/10 px-4 py-3 text-xs text-[#A39F88]">
            Mostrando {filtered.length} de {guests.length} invitados
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {createOpen ? (
          <Modal key="create" onClose={() => setCreateOpen(false)} title="Nuevo invitado">
            <GuestForm
              existingGroups={groups}
              onClose={() => setCreateOpen(false)}
              onSave={handleSave}
            />
          </Modal>
        ) : null}

        {editGuest ? (
          <Modal key="edit" onClose={() => setEditGuest(null)} title="Editar invitado">
            <GuestForm
              existingGroups={groups}
              initial={editGuest}
              onClose={() => setEditGuest(null)}
              onSave={handleSave}
            />
          </Modal>
        ) : null}

        {importOpen ? (
          <Modal key="import" onClose={() => setImportOpen(false)} title="Importar desde CSV">
            <ImportModal
              onClose={() => setImportOpen(false)}
              onImport={async (csv) => {
                await handleImport(csv);
              }}
            />
          </Modal>
        ) : null}

        {messageGuest ? (
          <Modal
            key="message"
            onClose={() => setMessageGuest(null)}
            title="Mensaje de amor"
          >
            <div className="flex flex-col gap-4">
              <div>
                <p className="font-semibold text-[#154D35]">{messageGuest.display_name}</p>
                <p className="text-xs text-[#837E5E]">{messageGuest.group_name}</p>
              </div>
              <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-[#837E5E]/25 bg-white px-5 py-4 text-[15px] italic leading-7 text-[#15351f]">
                "{messageGuest.message}"
              </div>
              <button
                className="flex items-center justify-center gap-2 rounded-full bg-[#154D35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0C1D0E]"
                onClick={async () => {
                  await navigator.clipboard.writeText(messageGuest.message);
                  setMsgCopied(true);
                  setTimeout(() => setMsgCopied(false), 2000);
                }}
                type="button"
              >
                {msgCopied ? (
                  <>
                    <Check size={16} /> ¡Copiado!
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={16} /> Copiar mensaje
                  </>
                )}
              </button>
            </div>
          </Modal>
        ) : null}
      </AnimatePresence>
    </main>
  );
}
