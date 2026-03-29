import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { runForTesting } from "./post-cli.mjs";
import { serializePostDocument } from "./post-lib.mjs";

const temporaryDirectories: string[] = [];

async function createWorkspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "blog-post-cli-"));
  temporaryDirectories.push(directory);
  await mkdir(path.join(directory, "post", "assets"), { recursive: true });
  return directory;
}

async function writePost(
  workspace: string,
  slug: string,
  fields: {
    title: string;
    date: string;
    tags: string[];
    draft?: boolean;
    body: string;
  },
) {
  await writeFile(
    path.join(workspace, "post", `${slug}.md`),
    serializePostDocument(fields),
    "utf8",
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => {
      return rm(directory, { recursive: true, force: true });
    }),
  );
});

describe("post CLI", () => {
  it("creates a draft post non-interactively", async () => {
    const workspace = await createWorkspace();

    const result = await runForTesting({
      argv: ["create", "--title", "Hello World", "--date", "2026-03-29", "--tags", "Notes, Demo"],
      cwd: workspace,
      interactive: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Created draft post 'hello-world'");

    const createdContent = await readFile(path.join(workspace, "post", "hello-world.md"), "utf8");
    expect(createdContent).toContain("draft: true");
    expect(createdContent).toContain("Write something here.");
  });

  it("refuses to overwrite an explicit slug", async () => {
    const workspace = await createWorkspace();

    await writePost(workspace, "hello-world", {
      title: "Hello World",
      date: "2026-03-29",
      tags: ["Notes"],
      draft: true,
      body: "Existing body.",
    });

    const result = await runForTesting({
      argv: [
        "create",
        "--title",
        "Another Hello",
        "--date",
        "2026-03-30",
        "--tags",
        "Notes",
        "--slug",
        "hello-world",
      ],
      cwd: workspace,
      interactive: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("A post already exists with slug 'hello-world'");
  });

  it("migrates numeric post names to unique title-based slugs", async () => {
    const workspace = await createWorkspace();

    await writePost(workspace, "post-1", {
      title: "Hello World",
      date: "2026-03-29",
      tags: ["Notes"],
      draft: true,
      body: "First body.",
    });

    await writePost(workspace, "post-2", {
      title: "Hello World",
      date: "2026-03-28",
      tags: ["Notes"],
      draft: true,
      body: "Second body.",
    });

    const result = await runForTesting({
      argv: ["migrate-slugs"],
      cwd: workspace,
      interactive: false,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("post-1 -> hello-world");
    expect(result.stdout).toContain("post-2 -> hello-world-2");

    const fileNames = await readdir(path.join(workspace, "post"));
    expect(fileNames).toContain("hello-world.md");
    expect(fileNames).toContain("hello-world-2.md");
  });

  it("reports missing local asset references during validation", async () => {
    const workspace = await createWorkspace();

    await writePost(workspace, "broken-post", {
      title: "Broken Post",
      date: "2026-03-29",
      tags: ["Notes"],
      draft: true,
      body: "![Missing](./assets/missing-image.png)",
    });

    const result = await runForTesting({
      argv: ["validate"],
      cwd: workspace,
      interactive: false,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("missing local reference './assets/missing-image.png'");
  });
});
