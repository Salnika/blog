export type Post = {
  id: string;
  title: string;
  date: string;
  tags: string[];
  content: string;
  draft?: boolean;
};

type FrontmatterValue = string | boolean | string[];

function splitFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/);

  if (lines.length === 0 || lines[0].trim() !== "---") {
    throw new Error("Invalid post: missing frontmatter opening '---'.");
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (endIndex === -1) {
    throw new Error("Invalid post: missing frontmatter closing '---'.");
  }

  const frontmatter = lines.slice(1, endIndex).join("\n");
  const body = lines
    .slice(endIndex + 1)
    .join("\n")
    .trim();
  return { frontmatter, body };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineList(value: string): string[] {
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

function parseScalar(value: string): FrontmatterValue {
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

function parseFrontmatter(frontmatter: string): Record<string, FrontmatterValue> {
  const result: Record<string, FrontmatterValue> = {};
  let currentListKey: string | null = null;

  for (const rawLine of frontmatter.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      const key = keyMatch[1];
      const rawValue = keyMatch[2].trim();

      if (!rawValue) {
        currentListKey = key;
        result[key] = [];
        continue;
      }

      currentListKey = null;
      result[key] = parseScalar(rawValue);
      continue;
    }

    const listItemMatch = line.match(/^-+\s+(.*)$/);
    if (listItemMatch && currentListKey) {
      const existing = result[currentListKey];
      if (Array.isArray(existing)) {
        existing.push(unquote(listItemMatch[1]));
      }
    }
  }

  return result;
}

function pathToId(path: string): string {
  const filename = path.split("/").pop();
  if (!filename) {
    throw new Error(`Invalid post path: ${path}`);
  }
  return filename.replace(/\.md$/i, "");
}

function requireString(value: FrontmatterValue | undefined, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid post: missing required frontmatter field '${field}'.`);
  }
  return value.trim();
}

function normalizeTags(value: FrontmatterValue | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => tag.trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    const single = value.trim();
    return single ? [single] : [];
  }

  return [];
}

function parsePost(path: string, raw: string): Post {
  const { frontmatter, body } = splitFrontmatter(raw);
  const fm = parseFrontmatter(frontmatter);

  const title = requireString(fm.title, "title");
  const date = requireString(fm.date, "date");
  const tags = normalizeTags(fm.tags);

  if (tags.length === 0) {
    throw new Error("Invalid post: missing required frontmatter field 'tags'.");
  }

  if (!body) {
    throw new Error("Invalid post: missing required content body.");
  }

  const draft = fm.draft === true;

  return {
    id: pathToId(path),
    title,
    date,
    tags,
    content: body,
    draft,
  };
}

const markdownModules = import.meta.glob("../../../post/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const posts: Post[] = Object.entries(markdownModules)
  .map(([path, raw]) => parsePost(path, raw))
  .sort((a, b) => {
    const aTime = Date.parse(a.date);
    const bTime = Date.parse(b.date);
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });

export const publishedPosts = posts.filter((post) => !post.draft);

const postsById = new Map(posts.map((post) => [post.id, post] as const));

export function getPostById(id: string): Post | undefined {
  return postsById.get(id);
}
