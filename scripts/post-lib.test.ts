import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  ensureUniqueSlug,
  isValidDateString,
  serializePostDocument,
  setPostDraftState,
  slugifyTitle,
} from "./post-lib.mjs";

const temporaryDirectories: string[] = [];

async function createWorkspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "blog-post-lib-"));
  temporaryDirectories.push(directory);
  await mkdir(path.join(directory, "post", "assets"), { recursive: true });
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => {
      return rm(directory, { recursive: true, force: true });
    }),
  );
});

describe("post-lib helpers", () => {
  it("slugifies titles and resolves collisions predictably", () => {
    expect(slugifyTitle("Été: Hello, World!")).toBe("ete-hello-world");
    expect(ensureUniqueSlug("hello-world", new Set(["hello-world", "hello-world-2"]))).toBe(
      "hello-world-3",
    );
  });

  it("validates strict ISO-like dates", () => {
    expect(isValidDateString("2026-02-21")).toBe(true);
    expect(isValidDateString("2026-02-021")).toBe(false);
    expect(isValidDateString("2026-02-30")).toBe(false);
  });

  it("toggles draft state by adding and removing the draft frontmatter field", async () => {
    const workspace = await createWorkspace();
    const filePath = path.join(workspace, "post", "hello-world.md");

    await writeFile(
      filePath,
      serializePostDocument({
        title: "Hello World",
        date: "2026-03-29",
        tags: ["Notes"],
        draft: true,
        body: "A body.",
      }),
      "utf8",
    );

    await setPostDraftState(workspace, "hello-world", false);
    const publishedContent = await readFile(filePath, "utf8");
    expect(publishedContent).not.toContain("draft: true");

    await setPostDraftState(workspace, "hello-world", true);
    const draftContent = await readFile(filePath, "utf8");
    expect(draftContent).toContain("draft: true");
  });
});
