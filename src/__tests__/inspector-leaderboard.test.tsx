import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import InspectorLeaderboard, {
  type LeaderboardInspector,
} from "@/components/analytics/InspectorLeaderboard";

const mk = (id: number, name: string, points: number): LeaderboardInspector => ({
  userId: id,
  displayName: name,
  points,
});

describe("InspectorLeaderboard", () => {
  it("renders ranks 4+ when current user is in the top 3", () => {
    const list = [
      mk(1, "Aom", 18),
      mk(2, "Boom", 14),
      mk(3, "Cherry", 11),
      mk(4, "Daeng", 8),
      mk(5, "Eak", 6),
    ];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={2} />
    );
    const rows = container.querySelectorAll('[data-row]');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('Daeng');
    expect(rows[1]?.textContent).toContain('Eak');
  });

  it("pins the current user at top when they are rank 5+, and keeps them inline", () => {
    const list = [
      mk(1, "Aom", 18),
      mk(2, "Boom", 14),
      mk(3, "Cherry", 11),
      mk(4, "Daeng", 8),
      mk(7, "You", 7),
      mk(5, "Eak", 6),
      mk(6, "Fay", 4),
    ];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={7} />
    );
    const pinned = container.querySelectorAll('[data-pinned="true"]');
    expect(pinned).toHaveLength(1);
    expect(pinned[0]?.textContent).toContain('You');
    const inline = container.querySelectorAll('[data-row]:not([data-pinned="true"])');
    expect(Array.from(inline).map((r) => r.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Daeng'), expect.stringContaining('You'), expect.stringContaining('Eak'), expect.stringContaining('Fay')])
    );
  });

  it("highlights the current user's row with the accent border in inline position", () => {
    const list = [
      mk(1, "Aom", 18),
      mk(2, "Boom", 14),
      mk(3, "Cherry", 11),
      mk(7, "You", 9),
    ];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={7} />
    );
    const youRow = container.querySelector('[data-row][data-is-you="true"]') as HTMLElement;
    expect(youRow).toBeTruthy();
    expect(youRow.textContent).toContain('You');
  });

  it("renders nothing when there are 3 or fewer inspectors and current user is among them", () => {
    const list = [mk(1, "Aom", 18), mk(2, "Boom", 14), mk(3, "Cherry", 11)];
    const { container } = render(
      <InspectorLeaderboard inspectors={list} currentUserId={1} />
    );
    const rows = container.querySelectorAll('[data-row]');
    expect(rows).toHaveLength(0);
  });
});
