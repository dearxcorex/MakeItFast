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
  it("renders two segment groups: Type (All/FM/INT) and Status (All/Pending/Inspected)", () => {
    const { container } = render(
      <MobileFilterBar
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("All");
    expect(text).toContain("FM");
    expect(text).toContain("INT");
    expect(text).toContain("Pending");
    expect(text).toContain("Inspected");
    expect(text).not.toContain("OFF AIR");
    expect(text).not.toContain("REVOKED");
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
      (b) => b.textContent?.trim() === "INT"
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
      (b) => b.textContent?.trim() === "Pending"
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
      (b.textContent ?? "").includes("More")
    );
    expect(more).toBeDefined();
    expect(more!.textContent).not.toMatch(/More\s*·\s*\d/);
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
      (b.textContent ?? "").includes("More")
    );
    expect(more!.textContent).toMatch(/More\s*·\s*3/);
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
      (b) => b.textContent?.trim() === "Reset"
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
      (b) => b.textContent?.trim() === "Reset"
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
      (b.textContent ?? "").includes("More")
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
      (b.textContent ?? "").includes("More")
    );
    fireEvent.click(more!);
    expect(window.sessionStorage.getItem("fo:filterSheetOpen")).toBe("true");
  });
});
