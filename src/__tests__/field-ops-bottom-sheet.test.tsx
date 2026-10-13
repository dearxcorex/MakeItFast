import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { FieldOpsBottomSheet } from "@/components/field-ops/FieldOpsBottomSheet";
import type { FMStation } from "@/types/station";

const baseStation: FMStation = {
  id: 1,
  idFm: "RFXL681242",
  name: "คนโพธิ์กลาง",
  frequency: 90.5,
  latitude: 14.97,
  longitude: 102.1,
  city: "เมืองนครราชสีมา",
  state: "นครราชสีมา",
  genre: "FM",
  inspection69: "ยังไม่ตรวจ",
  onAir: true,
};

function renderSheet(station: FMStation, over: Record<string, unknown> = {}) {
  const props = {
    selection: { kind: "fm" as const, id: station.id },
    station,
    site: null,
    onToggleInspection: vi.fn(),
    onToggleLawPaper: vi.fn(),
    onToggleOnAir: vi.fn(),
    onClose: vi.fn(),
    pending: false,
    ...over,
  };
  const utils = render(<FieldOpsBottomSheet {...props} />);
  const button = (text: string) =>
    Array.from(utils.container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === text
    );
  return { ...utils, props, button };
}

describe("FieldOpsBottomSheet", () => {
  it("collapsed view shows name, frequency and the two field actions only", () => {
    const { container, button } = renderSheet(baseStation);
    const text = container.textContent ?? "";
    expect(text).toContain("คนโพธิ์กลาง");
    expect(text).toContain("90.50 MHz");
    expect(text).toContain("นำทาง");
    expect(button("ตรวจ")).toBeDefined();
    // The on-air switch is a detail, not a peer of the two main actions.
    expect(text).not.toContain("สถานะออกอากาศ");
  });

  it("marking as inspected is a single tap", () => {
    const { button, props } = renderSheet(baseStation);
    fireEvent.click(button("ตรวจ")!);
    expect(props.onToggleInspection).toHaveBeenCalledTimes(1);
  });

  it("undoing an inspection asks first, and only the confirm button toggles", () => {
    const { button, props } = renderSheet({ ...baseStation, inspection69: "ตรวจแล้ว" });
    fireEvent.click(button("✓ ตรวจแล้ว")!);
    expect(props.onToggleInspection).not.toHaveBeenCalled();

    fireEvent.click(button("ไม่ยกเลิก")!);
    expect(props.onToggleInspection).not.toHaveBeenCalled();
    expect(button("✓ ตรวจแล้ว")).toBeDefined();

    fireEvent.click(button("✓ ตรวจแล้ว")!);
    fireEvent.click(button("ยกเลิกการตรวจ")!);
    expect(props.onToggleInspection).toHaveBeenCalledTimes(1);
  });

  it("the on-air switch lives in the expanded details", () => {
    const { container, button, props } = renderSheet(baseStation);
    fireEvent.click(button("รายละเอียด ▴")!);
    expect(container.textContent).toContain("สถานะออกอากาศ");
    fireEvent.click(button("เปลี่ยนเป็นไม่ออกอากาศ")!);
    expect(props.onToggleOnAir).toHaveBeenCalledTimes(1);
  });

  it("tags an off-air station in the collapsed view", () => {
    const on = renderSheet(baseStation);
    expect(on.container.textContent).not.toContain("ไม่ออกอากาศ");
    on.unmount();
    const off = renderSheet({ ...baseStation, onAir: false });
    expect(off.container.textContent).toContain("ไม่ออกอากาศ");
  });
});
