import type { FieldTask } from "../types";
import { googleMapsUrl } from "../types";
import { TypeBadge } from "./TypeBadge";
import { StatusPill, RankingDot } from "./StatusPill";

export function TaskCard({
  task,
  dense = false,
  onClick,
}: {
  task: FieldTask;
  dense?: boolean;
  onClick?: () => void;
}) {
  const CardElement = onClick ? "button" : "div";
  return (
    <CardElement
      type={onClick ? "button" : undefined}
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "#ffffff",
        border: "1px solid #b8c4c2",
        borderRadius: 12,
        padding: dense ? 12 : 16,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <TypeBadge type={task.type} />
        <span className="fo-mono">{task.id}</span>
        <span style={{ flex: 1 }} />
        <StatusPill status={task.status} />
      </div>

      <div
        className="fo-serif"
        style={{
          fontSize: dense ? 18 : 22,
          lineHeight: 1.15,
          color: "#001e2b",
          marginBottom: 6,
        }}
      >
        {task.title}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span className="fo-mono">{task.province.toUpperCase()} · {task.district}</span>
        {task.ranking && <RankingDot ranking={task.ranking} />}
      </div>

      {(task.freq || task.direction !== undefined) && (
        <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
          {task.freq && (
            <div>
              <div className="fo-mono">FREQ</div>
              <div className="fo-serif" style={{ fontSize: 18 }}>
                {task.freq.toFixed(2)}
                <span className="fo-mono" style={{ marginLeft: 4 }}>MHz</span>
              </div>
            </div>
          )}
          {task.direction !== undefined && (
            <div>
              <div className="fo-mono">BEARING</div>
              <div className="fo-serif" style={{ fontSize: 18 }}>
                {task.direction}
                <span className="fo-mono" style={{ marginLeft: 2 }}>°</span>
              </div>
            </div>
          )}
          {task.distanceKm > 0 && (
            <div>
              <div className="fo-mono">DISTANCE</div>
              <div className="fo-serif" style={{ fontSize: 18 }}>
                {task.distanceKm.toFixed(1)}
                <span className="fo-mono" style={{ marginLeft: 2 }}>km</span>
              </div>
            </div>
          )}
          {task.etaMinutes > 0 && (
            <div>
              <div className="fo-mono">ETA</div>
              <div className="fo-serif" style={{ fontSize: 18 }}>
                {task.etaMinutes}
                <span className="fo-mono" style={{ marginLeft: 2 }}>min</span>
              </div>
            </div>
          )}
        </div>
      )}

      {!dense && task.etaMinutes > 0 && (
        <a
          href={googleMapsUrl(task.lat, task.long)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="fo-mono"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 14,
            width: "100%",
            padding: "14px 20px",
            background: "#00ed64",
            color: "#001e2b",
            border: "none",
            borderRadius: 999,
            fontSize: 12,
            letterSpacing: "0.22em",
            fontWeight: 600,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          ▶ NAVIGATE IN GOOGLE MAPS
        </a>
      )}
    </CardElement>
  );
}
