import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { FontUpload } from "./FontUpload";
import { MAX_FONT_UPLOAD_BYTES } from "@/lib/domain/fontUpload";

const { upload, load } = vi.hoisted(() => ({ upload: vi.fn(), load: vi.fn() }));
vi.mock("./actions", () => ({ uploadThemeFontAction: upload }));
const font = {
  id: "custom-test",
  label: "Brand",
  family: "Brand",
  source: "file",
  url: "https://cdn.example.com/font.woff2",
  fallback: "sans",
  weight: "400",
  style: "normal",
};

beforeEach(() => {
  vi.clearAllMocks();
  load.mockResolvedValue({});
  vi.stubGlobal(
    "FontFace",
    class {
      load = load;
    }
  );
  upload.mockResolvedValue({ ok: true, data: font });
});
function choose(name = "brand.woff2", size = 100) {
  const file = new File(["font"], name);
  Object.defineProperty(file, "size", { value: size });
  Object.defineProperty(file, "arrayBuffer", { value: async () => new ArrayBuffer(100) });
  fireEvent.change(screen.getByLabelText("Upload a custom font"), { target: { files: [file] } });
}

it("uploads a decoded font and hands it to the draft with clear save guidance", async () => {
  const onUploaded = vi.fn(),
    onBusyChange = vi.fn();
  render(<FontUpload disabled={false} onUploaded={onUploaded} onBusyChange={onBusyChange} />);
  choose();
  await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(font));
  expect(upload).toHaveBeenCalledWith(expect.any(FormData));
  expect(screen.getByRole("status")).toHaveTextContent("Brand uploaded");
  expect(onBusyChange.mock.calls.map(([busy]) => busy)).toEqual([true, false]);
});

it("refuses oversized files before decoding or uploading", () => {
  render(<FontUpload disabled={false} onUploaded={vi.fn()} onBusyChange={vi.fn()} />);
  choose("brand.ttf", MAX_FONT_UPLOAD_BYTES + 1);
  expect(screen.getByRole("alert")).toHaveTextContent("5 MiB");
  expect(load).not.toHaveBeenCalled();
  expect(upload).not.toHaveBeenCalled();
});

it("keeps the draft unchanged on server failure and permits retry", async () => {
  const onUploaded = vi.fn();
  upload.mockResolvedValueOnce({ ok: false, error: "Your session has expired." });
  render(<FontUpload disabled={false} onUploaded={onUploaded} onBusyChange={vi.fn()} />);
  choose();
  await screen.findByRole("alert");
  expect(onUploaded).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Upload a custom font")).toBeEnabled();
  choose();
  await waitFor(() => expect(onUploaded).toHaveBeenCalledWith(font));
});

it("rejects damaged fonts before storage and disables unauthorized/full-library uploads", async () => {
  load.mockRejectedValueOnce(new Error("font decoder"));
  const { rerender } = render(
    <FontUpload disabled={false} onUploaded={vi.fn()} onBusyChange={vi.fn()} />
  );
  choose();
  await screen.findByRole("alert");
  expect(upload).not.toHaveBeenCalled();
  rerender(<FontUpload disabled onUploaded={vi.fn()} onBusyChange={vi.fn()} />);
  expect(screen.getByLabelText("Upload a custom font")).toBeDisabled();
});
