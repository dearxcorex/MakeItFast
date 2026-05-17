"use client";

import type { FieldOpsTab } from "./FieldOpsNav";
import type { FieldOpsKpis } from "@/utils/fieldOpsKpi";
import CrewIndicator from "./CrewIndicator";

interface NavItem {
  id: FieldOpsTab;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "field-ops", label: "FIELD OPS", icon: "⚑" },
  { id: "intermod", label: "INTERMOD", icon: "Σ" },
  { id: "analytics", label: "ANALYTICS", icon: "▦" },
];

export function FieldOpsDrawer({
  open,
  activeTab,
  theme,
  kpis,
  onChangeTab,
  onToggleTheme,
  onClose,
  defaultCrew,
  inspectors,
  onOpenCrew,
}: {
  open: boolean;
  activeTab: FieldOpsTab;
  theme: "dark" | "light";
  kpis: FieldOpsKpis;
  onChangeTab: (id: FieldOpsTab) => void;
  onToggleTheme: () => void;
  onClose: () => void;
  defaultCrew?: number[] | null;
  inspectors?: { id: number; username: string; displayName: string }[];
  onOpenCrew?: () => void;
}) {
  if (!open) return null;

  const handleNav = (id: FieldOpsTab) => {
    onChangeTab(id);
    onClose();
  };

  return (
    <>
      <div
        data-testid="fo-drawer-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.55)",
          zIndex: 50,
        }}
      />
      <aside
        role="dialog"
        aria-label="Field Ops navigation"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 280,
          background: "var(--fo-rail-bg)",
          color: "var(--fo-rail-text)",
          borderRight: "1px solid var(--fo-rail-border)",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          zIndex: 60,
          overflowY: "auto",
        }}
      >
        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 9, letterSpacing: "0.2em" }}>
          NAV
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                className="fo-mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: isActive ? "var(--fo-accent)" : "transparent",
                  color: isActive ? "#001e2b" : "var(--fo-rail-text)",
                  border: isActive ? "none" : "1px solid var(--fo-rail-border)",
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span aria-hidden style={{ fontSize: 14 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>

        <div style={{ height: 1, background: "var(--fo-rail-border)", margin: "4px 0" }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onToggleTheme}
            className="fo-mono"
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--fo-accent)",
              background: "transparent",
              color: "var(--fo-accent)",
              fontSize: 10,
              lineHeight: 1,
              cursor: "pointer",
              letterSpacing: "0.16em",
            }}
          >
            <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>
              {theme === "light" ? "☀" : "☾"}
            </span>
            <span style={{ lineHeight: 1 }}>{theme === "light" ? "LIGHT" : "DARK"}</span>
          </button>
          <span
            className="fo-mono"
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid var(--fo-accent)",
              color: "var(--fo-accent)",
              fontSize: 10,
              lineHeight: 1,
              letterSpacing: "0.16em",
            }}
          >
            <span aria-hidden style={{ fontSize: 10, lineHeight: 1 }}>
              ●
            </span>
            <span style={{ lineHeight: 1 }}>LIVE</span>
          </span>
        </div>

        {onOpenCrew && defaultCrew !== null && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: "1px solid var(--fo-rail-border)",
            }}
          >
            <span className="fo-mono" style={{ color: "var(--fo-rail-mute)" }}>MY CREW</span>
            <CrewIndicator
              defaultCrew={defaultCrew ?? null}
              inspectors={inspectors ?? []}
              onOpen={onOpenCrew}
              compact={false}
            />
          </div>
        )}

        <div style={{ height: 1, background: "var(--fo-rail-border)", margin: "4px 0" }} />

        <div className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 9, letterSpacing: "0.2em" }}>
          STATS
        </div>
        <StatsRow
          label="INSPECTED"
          value={`${kpis.inspected}/${kpis.target} · ${kpis.pct}%`}
          accent
        />
        <StatsRow label="PENDING" value={String(kpis.pending)} />
        <StatsRow
          label="CRITICAL"
          value={kpis.critical === null ? "—" : String(kpis.critical)}
          warn={kpis.critical !== null}
          mute={kpis.critical === null}
        />
      </aside>
    </>
  );
}

function StatsRow({
  label,
  value,
  accent = false,
  warn = false,
  mute = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  mute?: boolean;
}) {
  const valueColor = mute
    ? "var(--fo-rail-mute)"
    : accent
      ? "var(--fo-accent)"
      : warn
        ? "var(--fo-crit)"
        : "var(--fo-rail-text)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontSize: 12,
      }}
    >
      <span className="fo-mono" style={{ color: "var(--fo-rail-mute)", fontSize: 10 }}>
        {label}
      </span>
      <span style={{ color: valueColor }}>{value}</span>
    </div>
  );
}
