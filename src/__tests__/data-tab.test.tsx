import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { FieldOpsNav } from "@/components/field-ops/FieldOpsNav";
import { StationForm } from "@/components/field-ops/StationForm";
import { DataTab } from "@/components/field-ops/DataTab";
import type { AdminStation } from "@/types/station";

const station = (over: Partial<AdminStation> = {}): AdminStation => ({
  id: 10,
  idFm: "RFXL680004",
  registerStationId: 5550002,
  name: "สถานีเดิม",
  freq: 99.5,
  lat: 14.97,
  long: 102.1,
  district: "เมืองนครราชสีมา",
  province: "นครราชสีมา",
  type: "บริการธุรกิจ",
  permit: null,
  submitRequest: true,
  revoked: false,
  revokedNote: null,
  onAir: true,
  inspected: false,
  inspectionCount: 0,
  ...over,
});

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function field(container: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const span = Array.from(container.querySelectorAll("label > span")).find((s) =>
    s.textContent?.startsWith(label)
  );
  const el = span?.parentElement?.querySelector("input, select");
  if (!el) throw new Error(`no field ${label}`);
  return el as HTMLInputElement;
}

function fillValid(container: HTMLElement) {
  fireEvent.change(field(container, "ชื่อสถานี"), { target: { value: "สถานีใหม่" } });
  fireEvent.change(field(container, "ความถี่"), { target: { value: "101.25" } });
  fireEvent.change(field(container, "อำเภอ"), { target: { value: "โนนสูง" } });
  fireEvent.change(field(container, "จังหวัด"), { target: { value: "นครราชสีมา" } });
  fireEvent.change(field(container, "ประเภท"), { target: { value: "บริการชุมชน" } });
  fireEvent.change(field(container, "วางพิกัด"), { target: { value: "15.1, 102.0" } });
}

describe("FieldOpsNav DATA item", () => {
  it("is hidden unless showData is set", () => {
    const { getAllByRole, rerender } = render(<FieldOpsNav active="field-ops" onChange={vi.fn()} />);
    expect(getAllByRole("button").map((b) => b.getAttribute("aria-label"))).not.toContain("DATA");
    rerender(<FieldOpsNav active="field-ops" onChange={vi.fn()} showData />);
    expect(getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toContain("DATA");
  });
});

describe("StationForm", () => {
  it("fills lat and long from a pasted Google Maps pair", () => {
    const { container } = render(<StationForm station={null} onSaved={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(field(container, "วางพิกัด"), { target: { value: "15.1234, 102.5678" } });
    expect((field(container, "ละติจูด") as HTMLInputElement).value).toBe("15.1234");
    expect((field(container, "ลองจิจูด") as HTMLInputElement).value).toBe("102.5678");
  });

  it("shows field errors without calling the server when input is invalid", async () => {
    const { container, getByText } = render(
      <StationForm station={null} onSaved={vi.fn()} onClose={vi.fn()} />
    );
    fireEvent.click(getByText("บันทึก"));
    await waitFor(() => expect(container.textContent).toContain("กรุณาระบุชื่อสถานี"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs a new station and calls onSaved", async () => {
    fetchMock.mockReturnValue(jsonResponse(201, { station: station() }));
    const onSaved = vi.fn();
    const { container, getByText } = render(
      <StationForm station={null} onSaved={onSaved} onClose={vi.fn()} />
    );
    fillValid(container);
    fireEvent.click(getByText("บันทึก"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/stations");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({ name: "สถานีใหม่", freq: 101.25, lat: 15.1, long: 102, force: false });
  });

  it("shows duplicate matches, and บันทึกต่อ resends with force", async () => {
    fetchMock
      .mockReturnValueOnce(
        jsonResponse(409, {
          error: "possible_duplicate",
          matches: [{ id: 3, idFm: "X1", name: "สถานีซ้ำ", freq: 101.25, district: "โนนสูง" }],
        })
      )
      .mockReturnValueOnce(jsonResponse(201, { station: station() }));
    const onSaved = vi.fn();
    const { container, getByText } = render(
      <StationForm station={null} onSaved={onSaved} onClose={vi.fn()} />
    );
    fillValid(container);
    fireEvent.click(getByText("บันทึก"));
    await waitFor(() => expect(container.textContent).toContain("สถานีซ้ำ"));
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.click(getByText("บันทึกต่อ"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).force).toBe(true);
  });

  it("marks sync-owned fields on a station that is in the register", () => {
    const { container } = render(<StationForm station={station()} onSaved={vi.fn()} onClose={vi.fn()} />);
    expect(container.textContent).toContain("register sync จะเขียนทับ");
    const fresh = render(
      <StationForm station={station({ registerStationId: null })} onSaved={vi.fn()} onClose={vi.fn()} />
    );
    expect(fresh.container.textContent).not.toContain("register sync จะเขียนทับ");
  });

  it("disables delete for a station with inspection history", () => {
    const { getByText, container } = render(
      <StationForm station={station({ inspectionCount: 2 })} onSaved={vi.fn()} onClose={vi.fn()} />
    );
    expect((getByText("ลบ") as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain("มีประวัติการตรวจ 2 ครั้ง");
  });

  it("deletes after confirm, and does nothing if cancelled", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    fetchMock.mockReturnValue(jsonResponse(200, { ok: true }));
    const onSaved = vi.fn();
    const { getByText } = render(<StationForm station={station()} onSaved={onSaved} onClose={vi.fn()} />);

    fireEvent.click(getByText("ลบ"));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(getByText("ลบ"));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(confirm.mock.calls[1][0]).toContain("สถานีเดิม");
    expect(fetchMock.mock.calls[0]).toEqual(["/api/admin/stations/10", { method: "DELETE" }]);
  });
});

describe("DataTab", () => {
  it("lists stations, filters by search, and opens the edit form on row click", async () => {
    fetchMock.mockReturnValue(
      jsonResponse(200, {
        stations: [station(), station({ id: 11, idFm: null, name: "ชัยภูมิเรดิโอ", province: "ชัยภูมิ" })],
      })
    );
    const { container, getByPlaceholderText, getByText } = render(<DataTab onChanged={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toContain("ชัยภูมิเรดิโอ"));
    expect(container.textContent).toContain("2 / 2");

    fireEvent.change(getByPlaceholderText(/ค้นหา/), { target: { value: "ชัยภูมิเรดิโอ" } });
    expect(container.textContent).toContain("1 / 2");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);

    fireEvent.click(getByText("ชัยภูมิเรดิโอ"));
    expect(container.querySelector('form[aria-label="แก้ไขสถานี"]')).not.toBeNull();
  });

  it("refetches and notifies the parent after a save", async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? jsonResponse(201, { station: station() })
        : jsonResponse(200, { stations: [] })
    );
    const onChanged = vi.fn();
    const { container, getByText } = render(<DataTab onChanged={onChanged} />);
    await waitFor(() => expect(container.textContent).toContain("0 / 0"));

    fireEvent.click(getByText("+ เพิ่มสถานี"));
    fillValid(container);
    fireEvent.click(getByText("บันทึก"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const gets = fetchMock.mock.calls.filter(([, init]) => !init?.method);
    expect(gets).toHaveLength(2);
    expect(container.querySelector("form")).toBeNull();
  });
});
