import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import TimeframePills from "@/components/analytics/TimeframePills";

describe("TimeframePills", () => {
  it("renders month + ytd labels and marks the active one", () => {
    const { container } = render(
      <TimeframePills value="month" onChange={() => {}} monthLabel="MAY 2026" />
    );
    const buttons = container.querySelectorAll('button[role="tab"]');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toMatch(/MAY 2026/);
    expect(buttons[1]?.textContent).toMatch(/YTD/);
    expect(buttons[0]?.getAttribute("aria-selected")).toBe("true");
    expect(buttons[1]?.getAttribute("aria-selected")).toBe("false");
  });

  it("fires onChange when the other pill is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(
      <TimeframePills value="month" onChange={onChange} monthLabel="MAY 2026" />
    );
    const ytd = container.querySelectorAll('button[role="tab"]')[1]!;
    fireEvent.click(ytd);
    expect(onChange).toHaveBeenCalledWith("ytd");
  });
});
