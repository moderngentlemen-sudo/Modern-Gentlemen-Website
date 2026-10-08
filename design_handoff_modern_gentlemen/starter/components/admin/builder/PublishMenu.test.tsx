import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { BuilderStoreProvider, useBuilderStore } from "./StoreContext";
import { PublishMenu } from "./PublishMenu";
import type { BuilderCallbacks } from "./Builder";
import type { BuilderDocument, BuilderStore } from "./store";

afterEach(cleanup);

let store: BuilderStore;
function Grab() {
  store = useBuilderStore();
  return null;
}

const ok = { ok: true as const, data: { version: 4 } };

function setup(
  doc: Partial<BuilderDocument>,
  callbacks: Partial<BuilderCallbacks> = {},
  issues = 0
) {
  const onPublishNow = vi.fn();
  render(
    <BuilderStoreProvider
      init={{
        doc: {
          type: "page",
          id: "p",
          title: "Autumn Edit",
          slug: "autumn",
          status: "draft",
          version: 3,
          treeKey: "sections",
          rest: {},
          ...doc,
        },
        tree: [],
      }}
    >
      <Grab />
      <PublishMenu
        callbacks={callbacks as BuilderCallbacks}
        issues={issues}
        onPublishNow={onPublishNow}
      />
    </BuilderStoreProvider>
  );
  return { onPublishNow };
}

describe("PublishMenu", () => {
  it("publishes now from the main button", () => {
    const { onPublishNow } = setup({});
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onPublishNow).toHaveBeenCalled();
  });

  it("has no caret when nothing else is possible", () => {
    setup({});
    expect(screen.queryByRole("button", { name: "More publishing options" })).toBeNull();
  });

  it("schedules a draft for the chosen time and shows it as scheduled", async () => {
    const schedule = vi.fn(async () => ok);
    setup({}, { schedule });
    fireEvent.click(screen.getByRole("button", { name: "More publishing options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Schedule/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Tomorrow, 9:00" }));
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Schedule" }));
    });
    expect(schedule).toHaveBeenCalledTimes(1);
    const [iso] = schedule.mock.calls[0] as unknown as [string];
    const when = new Date(iso);
    expect(when.getHours()).toBe(9);
    expect(when.getTime()).toBeGreaterThan(Date.now());
    expect(store.getState().doc.status).toBe("scheduled");
    expect(store.getState().doc.scheduledFor).toBe(iso);
  });

  it("refuses to schedule while issues stand", () => {
    setup({}, { schedule: vi.fn() }, 2);
    fireEvent.click(screen.getByRole("button", { name: "More publishing options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Schedule/ }));
    const dialog = screen.getByRole("dialog");
    expect(
      (within(dialog).getByRole("button", { name: "Schedule" }) as HTMLButtonElement).className
    ).toMatch(/pointer-events-none/);
    expect(dialog.textContent).toMatch(/Fix the 2 issues/);
  });

  it("cancels a schedule by returning the page to draft", async () => {
    const unpublish = vi.fn(async () => ok);
    setup(
      { status: "scheduled", scheduledFor: "2030-01-01T09:00:00.000Z" },
      { schedule: vi.fn(), unpublish }
    );
    fireEvent.click(screen.getByRole("button", { name: "More publishing options" }));
    expect(screen.getByRole("menuitem", { name: /Change schedule/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancel schedule" }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel schedule" })
      );
    });
    expect(unpublish).toHaveBeenCalled();
    expect(store.getState().doc).toMatchObject({ status: "draft", scheduledFor: null });
  });

  it("unpublishes a live page, and never offers to schedule one", async () => {
    const unpublish = vi.fn(async () => ok);
    setup({ status: "published" }, { schedule: vi.fn(), unpublish });
    fireEvent.click(screen.getByRole("button", { name: "More publishing options" }));
    expect(screen.queryByRole("menuitem", { name: /Schedule/ })).toBeNull();
    fireEvent.click(screen.getByRole("menuitem", { name: /Unpublish page/ }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Unpublish" })
      );
    });
    expect(store.getState().doc.status).toBe("draft");
  });
});
