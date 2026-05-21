import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import NavigationPill from "@/components/interference/NavigationPill";

describe("NavigationPill", () => {
  it("renders bearing + distance when both present", () => {
    const { container } = render(<NavigationPill bearing={62} distance={5.4321} />);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('→ 062° · 5.4 km');
  });

  it("zero-pads bearings under 100", () => {
    const { container: c1 } = render(<NavigationPill bearing={5} distance={1} />);
    expect(c1.textContent).toContain('005°');
    const { container: c2 } = render(<NavigationPill bearing={90} distance={1} />);
    expect(c2.textContent).toContain('090°');
    const { container: c3 } = render(<NavigationPill bearing={359} distance={1} />);
    expect(c3.textContent).toContain('359°');
  });

  it("renders distance only when bearing is null", () => {
    const { container } = render(<NavigationPill bearing={null} distance={5.4} />);
    expect(container.textContent?.trim()).toBe('5.4 km');
  });

  it("renders 'pending source' when bearing present but distance null", () => {
    const { container } = render(<NavigationPill bearing={62} distance={null} />);
    expect(container.textContent?.replace(/\s+/g, ' ').trim()).toBe('→ 062° · pending source');
  });

  it("renders nothing when both bearing and distance are null", () => {
    const { container } = render(<NavigationPill bearing={null} distance={null} />);
    expect(container.firstChild).toBeNull();
  });
});
