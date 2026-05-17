import prisma from "@/lib/prisma";
import { convertToFMStation } from "@/services/stationService";
import { convertToInterferenceSite } from "@/services/interferenceService";
import { getSession } from "@/lib/session";
import FieldOpsClient from "./FieldOpsClient";

export default async function FieldOpsFetcher() {
  try {
    const session = await getSession();
    const [stations, interferenceRows, fmCityData, fmProvinceData] = await Promise.all([
      prisma.fm_station.findMany({ orderBy: { name: "asc" } }),
      prisma.interference_site.findMany({ orderBy: { site_name: "asc" } }),
      prisma.fm_station.findMany({
        select: { district: true },
        distinct: ["district"],
        orderBy: { district: "asc" },
      }),
      prisma.fm_station.findMany({
        select: { province: true },
        distinct: ["province"],
        orderBy: { province: "asc" },
      }),
    ]);

    const transformedStations = stations.map(convertToFMStation);
    const transformedInterference = interferenceRows.map(convertToInterferenceSite);
    const fmCities = fmCityData.map((r) => r.district).filter((c): c is string => !!c);
    const fmProvinces = fmProvinceData.map((r) => r.province).filter((p): p is string => !!p);

    const interferenceProvinces = Array.from(
      new Set(
        transformedInterference
          .map((s) => s.changwat)
          .filter((p): p is string => !!p)
      )
    ).sort();

    const provinces = Array.from(new Set([...fmProvinces, ...interferenceProvinces])).sort();

    const currentUser = session.userId
      ? { id: session.userId, displayName: session.displayName }
      : undefined;

    return (
      <FieldOpsClient
        initialStations={transformedStations}
        initialInterference={transformedInterference}
        initialCities={fmCities}
        initialProvinces={provinces}
        currentUser={currentUser}
      />
    );
  } catch (error) {
    console.error("Error fetching field ops data:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const hasDbUrl = !!process.env.DATABASE_URL;

    return (
      <div className="field-ops-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 480, padding: 24, background: "var(--fo-ink)", color: "var(--fo-white)", borderRadius: 16, border: "1px solid var(--fo-crit)" }}>
          <div className="fo-mono" style={{ color: "var(--fo-crit)", marginBottom: 8 }}>DATABASE ERROR</div>
          <div className="fo-serif" style={{ fontSize: 22, marginBottom: 8 }}>Failed to connect to database</div>
          <div style={{ fontSize: 12, color: "var(--fo-line)" }}>
            {hasDbUrl ? "DATABASE_URL is set" : "DATABASE_URL is missing"}
          </div>
          <pre style={{ marginTop: 12, fontSize: 11, color: "var(--fo-crit)", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
            {errorMessage}
          </pre>
        </div>
      </div>
    );
  }
}
