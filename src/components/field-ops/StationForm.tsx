"use client";

import { useState } from "react";
import type { AdminStation } from "@/types/station";
import { TARGET_PROVINCES } from "@/utils/offairAudit";
import { parseLatLngInput } from "@/utils/parseLatLng";
import { parseStationInput, STATION_TYPES, type StationInputField } from "@/utils/stationInput";

type Match = { id: number; idFm: string | null; name: string | null; freq: number | null; district: string | null };

interface FormState {
  name: string;
  freq: string;
  lat: string;
  long: string;
  district: string;
  province: string;
  type: string;
  idFm: string;
  permit: string;
  submitRequest: boolean;
  revoked: boolean;
  revokedNote: string;
}

function initialState(s: AdminStation | null): FormState {
  return {
    name: s?.name ?? "",
    freq: s?.freq != null ? String(s.freq) : "",
    lat: s?.lat != null ? String(s.lat) : "",
    long: s?.long != null ? String(s.long) : "",
    district: s?.district ?? "",
    province: s?.province ?? "",
    type: s?.type ?? "",
    idFm: s?.idFm ?? "",
    permit: s?.permit ?? "",
    submitRequest: s?.submitRequest ?? false,
    revoked: s?.revoked ?? false,
    revokedNote: s?.revokedNote ?? "",
  };
}

function toBody(f: FormState) {
  const n = (v: string) => (v.trim() === "" ? NaN : Number(v));
  return { ...f, freq: n(f.freq), lat: n(f.lat), long: n(f.long) };
}

/**
 * Add / edit form for one fm_station row, shown in the Data tab's side panel.
 * `station === null` means add. Saving calls `onSaved`; the parent refetches.
 */
export function StationForm({
  station,
  onSaved,
  onClose,
}: {
  station: AdminStation | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(station));
  const [errors, setErrors] = useState<Partial<Record<StationInputField, string>>>({});
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState("");

  const isNew = station === null;
  // Register sync overwrites these on any station it matches by StationID.
  const syncOwned = station?.registerStationId != null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setMatches(null);
  };

  const onPaste = (v: string) => {
    setPaste(v);
    const r = parseLatLngInput(v, "");
    if (r.ok) {
      setForm((f) => ({ ...f, lat: String(r.lat), long: String(r.lng) }));
      setPaste("");
    }
  };

  async function save(force = false) {
    setBanner(null);
    const body = toBody(form);
    const local = parseStationInput(body);
    if (!local.ok) {
      setErrors(local.errors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch(isNew ? "/api/admin/stations" : `/api/admin/stations/${station.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, force }),
      });
      if (res.ok) {
        onSaved();
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (json.error === "validation_error") setErrors(json.fields ?? {});
      else if (json.error === "id_fm_taken") setErrors({ idFm: "ID นี้มีสถานีอื่นใช้อยู่แล้ว" });
      else if (json.error === "possible_duplicate") setMatches(json.matches ?? []);
      else setBanner(`บันทึกไม่สำเร็จ (HTTP ${res.status})`);
    } catch {
      setBanner("บันทึกไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!station) return;
    const ok = window.confirm(
      `ลบสถานีนี้?\n\n${station.name}\n${station.freq ?? "—"} MHz · ${station.district}, ${station.province}`
    );
    if (!ok) return;
    setBusy(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/admin/stations/${station.id}`, { method: "DELETE" });
      if (res.ok) {
        onSaved();
        return;
      }
      const json = await res.json().catch(() => ({}));
      setBanner(
        json.error === "has_inspections"
          ? `ลบไม่ได้: มีประวัติการตรวจ ${json.count} ครั้ง — ใช้ "เพิกถอน" แทน`
          : `ลบไม่สำเร็จ (HTTP ${res.status})`
      );
    } catch {
      setBanner("ลบไม่สำเร็จ — เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  const syncHint = syncOwned ? "register sync จะเขียนทับ" : undefined;

  return (
    <form
      aria-label={isNew ? "เพิ่มสถานี" : "แก้ไขสถานี"}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="fo-serif" style={{ fontSize: 20, flex: 1 }}>
          {isNew ? "เพิ่มสถานี" : "แก้ไขสถานี"}
        </div>
        <button type="button" onClick={onClose} aria-label="ปิด" style={ghostButton}>
          ✕
        </button>
      </div>

      {banner && (
        <div role="alert" style={{ ...notice, borderColor: "var(--fo-crit)", color: "var(--fo-crit)" }}>
          {banner}
        </div>
      )}

      <Field label="ชื่อสถานี *" error={errors.name} hint={syncHint}>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} style={input} />
      </Field>

      <div style={row2}>
        <Field label="ความถี่ (MHz) *" error={errors.freq} hint={syncHint}>
          <input inputMode="decimal" value={form.freq} onChange={(e) => set("freq", e.target.value)} style={input} />
        </Field>
        <Field label="ID (รหัส กสทช.)" error={errors.idFm}>
          <input value={form.idFm} onChange={(e) => set("idFm", e.target.value)} style={input} />
        </Field>
      </div>

      <Field label="วางพิกัดจาก Google Maps">
        <input
          aria-label="วางพิกัด"
          placeholder="14.97, 102.10"
          value={paste}
          onChange={(e) => onPaste(e.target.value)}
          style={input}
        />
      </Field>
      <div style={row2}>
        <Field label="ละติจูด *" error={errors.lat} hint={syncHint}>
          <input inputMode="decimal" value={form.lat} onChange={(e) => set("lat", e.target.value)} style={input} />
        </Field>
        <Field label="ลองจิจูด *" error={errors.long} hint={syncHint}>
          <input inputMode="decimal" value={form.long} onChange={(e) => set("long", e.target.value)} style={input} />
        </Field>
      </div>

      <div style={row2}>
        <Field label="อำเภอ *" error={errors.district} hint={syncHint}>
          <input value={form.district} onChange={(e) => set("district", e.target.value)} style={input} />
        </Field>
        <Field label="จังหวัด *" error={errors.province}>
          <select value={form.province} onChange={(e) => set("province", e.target.value)} style={input}>
            <option value="">— เลือก —</option>
            {TARGET_PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="ประเภท *" error={errors.type}>
        <select value={form.type} onChange={(e) => set("type", e.target.value)} style={input}>
          <option value="">— เลือก —</option>
          {STATION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </Field>

      <Field label="ผู้รับใบอนุญาต">
        <input value={form.permit} onChange={(e) => set("permit", e.target.value)} style={input} />
      </Field>

      <label style={check}>
        <input type="checkbox" checked={form.submitRequest} onChange={(e) => set("submitRequest", e.target.checked)} />
        ยื่นคำขอแล้ว (จำเป็นก่อนเปิด on air)
      </label>

      <label style={check}>
        <input type="checkbox" checked={form.revoked} onChange={(e) => set("revoked", e.target.checked)} />
        เพิกถอน
      </label>
      {form.revoked && (
        <Field label="หมายเหตุการเพิกถอน">
          <input value={form.revokedNote} onChange={(e) => set("revokedNote", e.target.value)} style={input} />
        </Field>
      )}

      {matches && (
        <div role="alert" style={{ ...notice, borderColor: "var(--fo-warn)" }}>
          <div style={{ marginBottom: 6 }}>มีสถานีความถี่เดียวกันในอำเภอนี้แล้ว:</div>
          {matches.map((m) => (
            <div key={m.id} className="fo-mono" style={{ fontSize: 11 }}>
              {m.idFm ?? "—"} · {m.name} · {m.freq} MHz · {m.district}
            </div>
          ))}
          <button type="button" disabled={busy} onClick={() => void save(true)} style={{ ...primaryButton, marginTop: 8 }}>
            บันทึกต่อ
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="submit" disabled={busy} style={primaryButton}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </button>
        <button type="button" onClick={onClose} style={ghostButton}>
          ยกเลิก
        </button>
        <div style={{ flex: 1 }} />
        {!isNew && (
          <button
            type="button"
            disabled={busy || station.inspectionCount > 0}
            onClick={() => void remove()}
            title={
              station.inspectionCount > 0
                ? `มีประวัติการตรวจ ${station.inspectionCount} ครั้ง — ใช้ "เพิกถอน" แทน`
                : undefined
            }
            style={{ ...ghostButton, color: "var(--fo-crit)", borderColor: "var(--fo-crit)" }}
          >
            ลบ
          </button>
        )}
      </div>
      {!isNew && station.inspectionCount > 0 && (
        <div style={{ fontSize: 11, color: "var(--fo-band-mute)" }}>
          ลบไม่ได้: มีประวัติการตรวจ {station.inspectionCount} ครั้ง — ใช้ “เพิกถอน” แทน
        </div>
      )}
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 11, color: "var(--fo-band-mute)" }}>
        {label}
        {hint && <span style={{ color: "var(--fo-warn)", marginLeft: 6 }}>· {hint}</span>}
      </span>
      {children}
      {error && <span style={{ fontSize: 11, color: "var(--fo-crit)" }}>{error}</span>}
    </label>
  );
}

const input: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--fo-divider)",
  background: "var(--fo-band-inset)",
  color: "var(--fo-band-text)",
  fontSize: 13,
  width: "100%",
};

const row2: React.CSSProperties = { display: "flex", gap: 10 };

const check: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13 };

const notice: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 8,
  padding: 10,
  fontSize: 12,
};

const primaryButton: React.CSSProperties = {
  padding: "7px 16px",
  borderRadius: 999,
  border: "none",
  background: "var(--fo-accent)",
  color: "#001e2b",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  border: "1px solid var(--fo-divider)",
  background: "transparent",
  color: "var(--fo-band-text)",
  cursor: "pointer",
};
