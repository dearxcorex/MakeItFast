import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MobileFilterSheet } from "@/components/field-ops/MobileFilterSheet";
import { DEFAULT_FILTERS, type FieldFilters } from "@/components/field-ops/FieldOpsFilters";

function baseFilters(o: Partial<FieldFilters> = {}): FieldFilters {
  return { ...DEFAULT_FILTERS, ...o };
}

describe("MobileFilterSheet", () => {
  it("renders search input, province select, and FM + INT toggle blocks when type=ALL", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A", "B"]}
        resultCount={42}
      />
    );
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
    expect(container.querySelector("select")).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("Off air");
    expect(text).toContain("Revoked");
    expect(text).toContain("Law-paper sent");
  });

  it("hides INT toggles when type=FM", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters({ type: "FM" })}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Off air");
    expect(text).not.toContain("Law-paper sent");
  });

  it("hides FM toggles when type=INT", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters({ type: "INT" })}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("Off air");
    expect(text).not.toContain("Revoked");
    expect(text).toContain("Law-paper sent");
  });

  it("typing in search calls onChange with new search value", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "fm99" } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, search: "fm99" });
  });

  it("changing province calls onChange with new province", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["Bangkok", "Chiang Mai"]}
        resultCount={1}
      />
    );
    const select = container.querySelector("select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Bangkok" } });
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, province: "Bangkok" });
  });

  it("tapping Off air toggle inverts filters.offAir", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const btn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Off air")
    );
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, offAir: true });
  });

  it("active-chip row is hidden when no advanced filters are set", () => {
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    expect(container.textContent ?? "").not.toContain("Active:");
  });

  it("active-chip row shows applied advanced filters; clicking a chip clears it", () => {
    const onChange = vi.fn();
    const filters = baseFilters({ search: "btc", province: "Bangkok", offAir: true });
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={vi.fn()}
        filters={filters}
        onChange={onChange}
        provinces={["Bangkok"]}
        resultCount={1}
      />
    );
    expect(container.textContent ?? "").toContain("Active:");
    expect(container.textContent ?? "").toContain('Search "btc"');
    expect(container.textContent ?? "").toContain("Province: Bangkok");
    expect(container.textContent ?? "").toContain("Off air");

    const offAirChip = Array.from(container.querySelectorAll("button")).find(
      (b) => (b.textContent ?? "").startsWith("Off air") && (b.textContent ?? "").includes("✕")
    );
    expect(offAirChip).toBeDefined();
    fireEvent.click(offAirChip!);
    expect(onChange).toHaveBeenCalledWith({ ...filters, offAir: false });
  });

  it("bottom CTA shows the resultCount and calls onClose when tapped", () => {
    const onClose = vi.fn();
    const onChange = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={onClose}
        filters={baseFilters()}
        onChange={onChange}
        provinces={["A"]}
        resultCount={247}
      />
    );
    const cta = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("Show 247 results")
    );
    expect(cta).toBeDefined();
    fireEvent.click(cta!);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    const { container } = render(
      <MobileFilterSheet
        open
        onClose={onClose}
        filters={baseFilters()}
        onChange={vi.fn()}
        provinces={["A"]}
        resultCount={1}
      />
    );
    const backdrop = container.querySelector('[data-testid="fo-filter-sheet-backdrop"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
