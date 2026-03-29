import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_POST_BODY = ["> Draft notes", "", "Write something here."].join("\n");

function padNumber(value) {
  return String(value).padStart(2, "0");
}

export function getTodayDate(date = new Date()) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

export function slugifyTitle(title) {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidSlug(slug) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function isValidDateString(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function parseTagsInput(value) {
  return String(value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function ensureUniqueSlug(baseSlug, usedSlugs) {
  let candidate = baseSlug;
  let counter = 2;

  while (usedSlugs.has(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return candidate;
}

function normalizeMarkdown(markdown) {
  return markdown.replace(/^\uFEFF/, "");
}

export function splitFrontmatter(markdown) {
  const normalized = normalizeMarkdown(markdown);
  const lines = normalized.split(/\r?\n/);

  if (lines.length === 0 || lines[0].trim() !== "---") {
    throw new Error("Invalid post: missing frontmatter opening '---'.");
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");

  if (endIndex === -1) {
    throw new Error("Invalid post: missing frontmatter closing '---'.");
  }

  return {
    frontmatter: lines.slice(1, endIndex).join("\n"),
    body: lines
      .slice(endIndex + 1)
      .join("\n")
      .trim(),
  };
}

function unquote(value) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseInlineList(value) {
  const inner = value.slice(1, -1).trim();

  if (!inner) {
    return [];
  }

  return inner
    .split(",")
    .map((item) => unquote(item))
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseScalar(value) {
  const trimmed = value.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseInlineList(trimmed);
  }

  return unquote(trimmed);
}

export function parseFrontmatter(frontmatter) {
  const result = {};
  let currentListKey = null;

  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const keyMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);

    if (keyMatch) {
      const [, key, rawValue] = keyMatch;
      const value = rawValue.trim();

      if (!value) {
        currentListKey = key;
        result[key] = [];
        continue;
      }

      currentListKey = null;
      result[key] = parseScalar(value);
      continue;
    }

    const listItemMatch = /^-+\s+(.*)$/.exec(line);
    if (listItemMatch && currentListKey) {
      const existing = result[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(unquote(listItemMatch[1]));
      }
    }
  }

  return result;
}

function normalizeTagsValue(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}

function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid post: missing required frontmatter field '${field}'.`);
  }

  return value.trim();
}

export function serializePostDocument(post) {
  const body = String(post.body ?? "").trim() || DEFAULT_POST_BODY;
  const lines = ["---", `title: ${post.title}`, `date: ${post.date}`, "tags:"];

  for (const tag of post.tags) {
    lines.push(`  - ${tag}`);
  }

  if (post.draft) {
    lines.push("draft: true");
  }

  lines.push("---", "", body);
  return `${lines.join("\n")}\n`;
}

export function parsePostDocument(raw, filePath) {
  const { frontmatter, body } = splitFrontmatter(raw);
  const data = parseFrontmatter(frontmatter);
  const title = requireString(data.title, "title");
  const date = requireString(data.date, "date");
  const tags = normalizeTagsValue(data.tags);

  if (tags.length === 0) {
    throw new Error("Invalid post: missing required frontmatter field 'tags'.");
  }

  if (!body) {
    throw new Error("Invalid post: missing required content body.");
  }

  return {
    slug: path.basename(filePath, ".md"),
    filePath,
    title,
    date,
    tags,
    body,
    draft: data.draft === true,
  };
}

export function getPostDirectory(cwd) {
  return path.resolve(cwd, "post");
}

export function getPostFilePath(cwd, slug) {
  return path.join(getPostDirectory(cwd), `${slug}.md`);
}

export async function ensurePostDirectory(cwd) {
  const postDirectory = getPostDirectory(cwd);
  await mkdir(postDirectory, { recursive: true });
  return postDirectory;
}

export async function listPostFileNames(cwd) {
  const postDirectory = await ensurePostDirectory(cwd);
  const entries = await readdir(postDirectory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export async function listPostSlugs(cwd) {
  const fileNames = await listPostFileNames(cwd);
  return fileNames.map((fileName) => path.basename(fileName, ".md"));
}

export async function readPosts(cwd) {
  const postDirectory = await ensurePostDirectory(cwd);
  const fileNames = await listPostFileNames(cwd);
  const posts = [];

  for (const fileName of fileNames) {
    const filePath = path.join(postDirectory, fileName);
    const raw = await readFile(filePath, "utf8");
    posts.push(parsePostDocument(raw, filePath));
  }

  return posts.sort((left, right) => {
    return right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug);
  });
}

export async function createPost(cwd, input) {
  await ensurePostDirectory(cwd);

  const title = String(input.title ?? "").trim();
  const date = String(input.date ?? "").trim();
  const tags = Array.isArray(input.tags)
    ? input.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const explicitSlug = input.slug == null ? "" : String(input.slug).trim();
  const draft = input.draft !== false;

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!isValidDateString(date)) {
    throw new Error(`Invalid date '${date}'. Expected YYYY-MM-DD.`);
  }

  if (tags.length === 0) {
    throw new Error("At least one tag is required.");
  }

  const usedSlugs = new Set(await listPostSlugs(cwd));
  let slug;

  if (explicitSlug) {
    if (!isValidSlug(explicitSlug)) {
      throw new Error(
        `Invalid slug '${explicitSlug}'. Use lowercase letters, numbers, and dashes.`,
      );
    }

    if (usedSlugs.has(explicitSlug)) {
      throw new Error(`A post already exists with slug '${explicitSlug}'.`);
    }

    slug = explicitSlug;
  } else {
    const baseSlug = slugifyTitle(title);

    if (!baseSlug) {
      throw new Error("Could not derive a slug from the title.");
    }

    slug = ensureUniqueSlug(baseSlug, usedSlugs);
  }

  const filePath = getPostFilePath(cwd, slug);
  const body = String(input.body ?? "").trim() || DEFAULT_POST_BODY;

  await writeFile(filePath, serializePostDocument({ title, date, tags, draft, body }), "utf8");

  return {
    slug,
    filePath,
    draft,
  };
}

export async function readPostBySlug(cwd, slug) {
  const filePath = getPostFilePath(cwd, slug);

  if (!existsSync(filePath)) {
    throw new Error(`Post '${slug}' does not exist.`);
  }

  const raw = await readFile(filePath, "utf8");
  return parsePostDocument(raw, filePath);
}

export async function setPostDraftState(cwd, slug, draft) {
  const post = await readPostBySlug(cwd, slug);
  await writeFile(
    post.filePath,
    serializePostDocument({
      title: post.title,
      date: post.date,
      tags: post.tags,
      body: post.body,
      draft,
    }),
    "utf8",
  );

  return {
    ...post,
    draft,
  };
}

export async function deletePost(cwd, slug) {
  const filePath = getPostFilePath(cwd, slug);

  if (!existsSync(filePath)) {
    throw new Error(`Post '${slug}' does not exist.`);
  }

  await rm(filePath);
  return filePath;
}

function normalizeReferencePath(reference) {
  const withoutHash = reference.split("#")[0];
  const withoutQuery = withoutHash.split("?")[0];

  try {
    return decodeURI(withoutQuery);
  } catch {
    return withoutQuery;
  }
}

function extractMarkdownReferences(body) {
  const references = [];
  const markdownPattern = /!?\[[^\]]*]\(([^)]+)\)/g;
  let match;

  while ((match = markdownPattern.exec(body)) !== null) {
    const rawTarget = match[1].trim();
    const target =
      rawTarget.startsWith("<") && rawTarget.endsWith(">")
        ? rawTarget.slice(1, -1)
        : rawTarget.split(/\s+/)[0];
    references.push(target);
  }

  const htmlPattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/g;

  while ((match = htmlPattern.exec(body)) !== null) {
    references.push(match[1]);
  }

  return references;
}

export async function validatePosts(cwd) {
  const postDirectory = await ensurePostDirectory(cwd);
  const fileNames = await listPostFileNames(cwd);
  const issues = [];
  const seenSlugs = new Map();
  let postCount = 0;

  for (const fileName of fileNames) {
    const slug = path.basename(fileName, ".md");
    const filePath = path.join(postDirectory, fileName);
    const relativePath = path.relative(cwd, filePath);

    if (!isValidSlug(slug)) {
      issues.push(`${relativePath}: invalid slug '${slug}'.`);
    }

    const duplicatePath = seenSlugs.get(slug);
    if (duplicatePath) {
      issues.push(`${relativePath}: duplicate slug '${slug}' also used by ${duplicatePath}.`);
    } else {
      seenSlugs.set(slug, relativePath);
    }

    try {
      const raw = await readFile(filePath, "utf8");
      const post = parsePostDocument(raw, filePath);
      postCount += 1;

      if (!isValidDateString(post.date)) {
        issues.push(`${relativePath}: invalid date '${post.date}'. Expected YYYY-MM-DD.`);
      }

      for (const reference of extractMarkdownReferences(post.body)) {
        if (!reference.startsWith("./") && !reference.startsWith("../")) {
          continue;
        }

        const normalizedReference = normalizeReferencePath(reference);
        const resolvedPath = path.resolve(postDirectory, normalizedReference);
        if (!existsSync(resolvedPath)) {
          issues.push(`${relativePath}: missing local reference '${reference}'.`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      issues.push(`${relativePath}: ${message}`);
    }
  }

  return {
    postCount,
    issues,
  };
}

export async function migratePostSlugs(cwd) {
  const postDirectory = await ensurePostDirectory(cwd);
  const fileNames = await listPostFileNames(cwd);
  const posts = [];

  for (const fileName of fileNames) {
    const filePath = path.join(postDirectory, fileName);
    const raw = await readFile(filePath, "utf8");
    posts.push(parsePostDocument(raw, filePath));
  }

  posts.sort((left, right) => left.slug.localeCompare(right.slug));

  const usedSlugs = new Set();
  const renamePlan = posts.map((post) => {
    const baseSlug = slugifyTitle(post.title);
    if (!baseSlug) {
      throw new Error(`Could not derive a slug from title '${post.title}'.`);
    }

    const targetSlug = ensureUniqueSlug(baseSlug, usedSlugs);
    usedSlugs.add(targetSlug);

    return {
      fromSlug: post.slug,
      toSlug: targetSlug,
      fromPath: post.filePath,
      toPath: getPostFilePath(cwd, targetSlug),
      changed: post.slug !== targetSlug,
    };
  });

  const changedRenames = renamePlan.filter((entry) => entry.changed);

  for (let index = 0; index < changedRenames.length; index += 1) {
    const renameEntry = changedRenames[index];
    renameEntry.tempPath = path.join(
      postDirectory,
      `.${renameEntry.fromSlug}.migrate-${index}.tmp.md`,
    );
    await rename(renameEntry.fromPath, renameEntry.tempPath);
  }

  for (const renameEntry of changedRenames) {
    await rename(renameEntry.tempPath, renameEntry.toPath);
  }

  return renamePlan;
}
