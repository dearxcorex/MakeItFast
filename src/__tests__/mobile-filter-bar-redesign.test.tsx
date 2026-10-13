import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MobileFilterBar } from "@/components/field-ops/MobileFilterBar";
import { DEFAULT_FILTERS, type FieldFilters } from "@/components/field-ops/FieldOpsFilters";

function baseFilters(o: Partial<FieldFilters> = {}): FieldFilters {
  return { ...DEFAULT_FILTERS, ...o };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("MobileFilterBar (redesigned)", () => {
  it("keeps Status chips in the bar and Type (All/FM/INT) in the sheet", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("ทั้งหมด");
    expect(text).toContain("FM");
    expect(text).toContain("รบกวน");
    expect(text).toContain("ยังไม่ตรวจ");
    expect(text).toContain("ตรวจแล้ว");
    // One row: the bar itself holds only the status chips and the filter
    // button. Type, the advanced toggles and reset live in the (hidden) sheet.
    const barChips = Array.from(container.querySelectorAll("button"))
      .filter((b) => !b.closest('[role="dialog"]'))
      .map((b) => b.textContent ?? "")
      .join(" ");
    expect(barChips).toContain("ยังไม่ตรวจ");
    expect(barChips).not.toContain("FM");
    expect(barChips).not.toContain("รบกวน");
    expect(barChips).not.toContain("ล้าง");
    expect(barChips).not.toContain("ไม่ออกอากาศ");
    expect(barChips).not.toContain("เพิกถอน");
  });

  it("chips can shrink so the row never pushes the page sideways", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const chip = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "ตรวจแล้ว"
    );
    expect(chip).toBeDefined();
    expect(chip!.style.minWidth).toBe("0px");
    expect(chip!.style.flexBasis).toBe("0px");
    expect(chip!.style.flexShrink).toBe("1");
    expect(chip!.style.overflow).toBe("hidden");
  });

  it("tapping FM chip calls onChange with type=FM and lawSent=false", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ lawSent: true })}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const fmBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "FM"
    );
    expect(fmBtn).toBeDefined();
    fireEvent.click(fmBtn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FM", lawSent: false })
    );
  });

  it("tapping INT chip zeroes offAir and revoked", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ offAir: true, revoked: true })}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const intBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "รบกวน"
    );
    fireEvent.click(intBtn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INT", offAir: false, revoked: false })
    );
  });

  it("tapping Pending chip calls onChange with status=PENDING", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "ยังไม่ตรวจ"
    );
    fireEvent.click(btn!);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING" })
    );
  });

  it("More button shows just 'More' when no advanced filters set", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("ตัวกรอง")
    );
    expect(more).toBeDefined();
    expect(more!.textContent).not.toMatch(/ตัวกรอง\s*·\s*\d/);
  });

  it("filter button counts a non-default type, since type is no longer visible in the bar", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ type: "FM" })}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("ตัวกรอง")
    );
    expect(more!.textContent).toMatch(/ตัวกรอง\s*·\s*1/);
  });

  it("More button shows count when advanced filters are set", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ search: "abc", province: "X", offAir: true })}
        onChange={vi.fn()}
        provinces={["X"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("ตัวกรอง")
    );
    expect(more!.textContent).toMatch(/ตัวกรอง\s*·\s*3/);
  });

  it("Reset button is hidden in default state", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const reset = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "ล้าง"
    );
    expect(reset).toBeUndefined();
  });

  it("Reset button appears when any filter is non-default; clicking it calls onChange with DEFAULT_FILTERS", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters({ type: "FM" })}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const reset = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "ล้าง"
    );
    expect(reset).toBeDefined();
    fireEvent.click(reset!);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });

  it("sheet is closed by default; tapping More opens it", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={5}
      />
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-hidden")).toBe("true");

    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("ตัวกรอง")
    );
    fireEvent.click(more!);
    expect(dialog!.getAttribute("aria-hidden")).toBe("false");
  });

  it("sheet open state persists to sessionStorage", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const more = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("ตัวกรอง")
    );
    fireEvent.click(more!);
    expect(window.sessionStorage.getItem("fo:filterSheetOpen")).toBe("true");
  });
});
