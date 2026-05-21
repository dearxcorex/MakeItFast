import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import InspectorPodium, { type PodiumInspector } from "@/components/analytics/InspectorPodium";

const mk = (id: number, name: string, points: number): PodiumInspector => ({
  userId: id,
  displayName: name,
  points,
});

describe("InspectorPodium", () => {
  it("renders three pedestals in silver/gold/bronze column order", () => {
    const { container } = render(
      <InspectorPodium
        inspectors={[mk(1, "Aom", 18), mk(2, "Boom", 14), mk(3, "Cherry", 11)]}
        currentUserId={null}
      />
    );
    const places = container.querySelectorAll('[data-place]');
    expect(places).toHaveLength(3);
    expect(places[0]?.getAttribute('data-place')).toBe('silver');
    expect(places[1]?.getAttribute('data-place')).toBe('gold');
    expect(places[2]?.getAttribute('data-place')).toBe('bronze');
    expect(places[1]?.textContent).toContain('Aom');
    expect(places[0]?.textContent).toContain('Boom');
    expect(places[2]?.textContent).toContain('Cherry');
  });

  it("renders only filled pedestals when fewer than 3 inspectors have points", () => {
    const { container } = render(
      <InspectorPodium
        inspectors={[mk(1, "Aom", 5), mk(2, "Boom", 3)]}
        currentUserId={null}
      />
    );
    const places = container.querySelectorAll('[data-place]');
    expect(places).toHaveLength(2);
    expect(places[0]?.getAttribute('data-place')).toBe('gold');
    expect(places[1]?.getAttribute('data-place')).toBe('silver');
  });

  it("renders empty state when no inspectors have points", () => {
    const { container } = render(
      <InspectorPodium inspectors={[]} currentUserId={null} />
    );
    expect(container.textContent).toMatch(/no inspections recorded/i);
  });

  it("adds an accent ring on the current user's pedestal", () => {
    const { container } = render(
      <InspectorPodium
        inspectors={[mk(1, "Aom", 18), mk(7, "You", 14), mk(3, "Cherry", 11)]}
        currentUserId={7}
      />
    );
    const silver = container.querySelector('[data-place="silver"]') as HTMLElement;
    expect(silver.getAttribute('data-is-you')).toBe('true');
  });
});

import InspectorPodiumMobile from "@/components/analytics/InspectorPodiumMobile";

describe("InspectorPodiumMobile", () => {
  it("renders top-3 as stacked gold/silver/bronze cards in 1→2→3 order", () => {
    const { container } = render(
      <InspectorPodiumMobile
        inspectors={[mk(1, "Aom", 18), mk(2, "Boom", 14), mk(3, "Cherry", 11)]}
        currentUserId={null}
      />
    );
    const cards = container.querySelectorAll('[data-medal]');
    expect(cards).toHaveLength(3);
    expect(cards[0]?.getAttribute('data-medal')).toBe('gold');
    expect(cards[1]?.getAttribute('data-medal')).toBe('silver');
    expect(cards[2]?.getAttribute('data-medal')).toBe('bronze');
  });

  it("marks the current user's card", () => {
    const { container } = render(
      <InspectorPodiumMobile
        inspectors={[mk(1, "Aom", 18), mk(7, "You", 14), mk(3, "Cherry", 11)]}
        currentUserId={7}
      />
    );
    const silver = container.querySelector('[data-medal="silver"]') as HTMLElement;
    expect(silver.getAttribute('data-is-you')).toBe('true');
  });
});
