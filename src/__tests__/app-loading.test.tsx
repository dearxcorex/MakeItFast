import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Loading from "@/app/loading";

describe("app/loading.tsx", () => {
  it("renders the field-ops shell + spinner", () => {
    const { container, getByRole } = render(<Loading />);
    expect(container.querySelector(".field-ops-root")).toBeTruthy();
    expect(getByRole("status")).toBeTruthy();
  });
});
