import readline from "node:readline/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

import {
  createPost,
  deletePost,
  getTodayDate,
  isValidDateString,
  isValidSlug,
  migratePostSlugs,
  parseTagsInput,
  readPosts,
  setPostDraftState,
  slugifyTitle,
  validatePosts,
} from "./post-lib.mjs";

function createWriter() {
  let buffer = "";

  return {
    stream: {
      isTTY: false,
      write(chunk) {
        buffer += String(chunk);
      },
    },
    toString() {
      return buffer;
    },
  };
}

const GLOBAL_HELP = `
Usage:
  node scripts/post-cli.mjs <command> [options]

Commands:
  create         Create a new post
  list           List posts
  validate       Validate post files and local assets
  publish <slug> Mark a post as published
  draft <slug>   Mark a post as draft
  delete <slug>  Delete a post file
  migrate-slugs  Rename posts to title-based slugs
`.trim();

function getCommandHelp(command) {
  switch (command) {
    case "create":
      return `
Usage:
  node scripts/post-cli.mjs create [--title TITLE] [--date YYYY-MM-DD] [--tags a,b] [--slug SLUG] [--draft|--published]
`.trim();
    case "list":
      return `
Usage:
  node scripts/post-cli.mjs list [--drafts|--published]
`.trim();
    case "publish":
      return `
Usage:
  node scripts/post-cli.mjs publish <slug>
`.trim();
    case "draft":
      return `
Usage:
  node scripts/post-cli.mjs draft <slug>
`.trim();
    case "delete":
      return `
Usage:
  node scripts/post-cli.mjs delete <slug> [--yes]
`.trim();
    case "migrate-slugs":
      return `
Usage:
  node scripts/post-cli.mjs migrate-slugs
`.trim();
    case "validate":
      return `
Usage:
  node scripts/post-cli.mjs validate
`.trim();
    default:
      return GLOBAL_HELP;
  }
}

function parseArgs(argv) {
  const booleanFlags = new Set(["draft", "published", "drafts", "yes", "help"]);
  const flags = {};
  const positional = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      positional.push(...argv.slice(index + 1));
      break;
    }

    if (arg === "-y") {
      flags.yes = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const option = arg.slice(2);
      const [name, inlineValue] = option.split("=", 2);

      if (inlineValue !== undefined) {
        flags[name] = inlineValue;
        continue;
      }

      if (booleanFlags.has(name)) {
        flags[name] = true;
        continue;
      }

      const nextArg = argv[index + 1];
      if (nextArg == null || nextArg.startsWith("-")) {
        flags[name] = true;
        continue;
      }

      flags[name] = nextArg;
      index += 1;
      continue;
    }

    positional.push(arg);
  }

  return {
    flags,
    positional,
  };
}

function isInteractiveSession(input, output, interactive) {
  if (typeof interactive === "boolean") {
    return interactive;
  }

  return Boolean(input?.isTTY && output?.isTTY);
}

async function promptText(rl, message, defaultValue) {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = (await rl.question(`${message}${suffix}: `)).trim();
  return answer || defaultValue || "";
}

async function promptRequiredText(rl, message, defaultValue) {
  while (true) {
    const answer = await promptText(rl, message, defaultValue);
    if (answer.trim()) {
      return answer.trim();
    }
  }
}

async function promptYesNo(rl, message, defaultValue) {
  const suffix = defaultValue ? " [Y/n]" : " [y/N]";

  while (true) {
    const answer = (await rl.question(`${message}${suffix}: `)).trim().toLowerCase();

    if (!answer) {
      return defaultValue;
    }

    if (answer === "y" || answer === "yes") {
      return true;
    }

    if (answer === "n" || answer === "no") {
      return false;
    }
  }
}

function resolveSlugArgument(flags, positional) {
  return String(positional[0] ?? flags.slug ?? "").trim();
}

async function handleCreate({ cwd, flags, input, output, interactive }) {
  const useInteractive = isInteractiveSession(input, output, interactive);
  const draftFlag = flags.draft === true;
  const publishedFlag = flags.published === true;

  if (draftFlag && publishedFlag) {
    throw new Error("Use either --draft or --published, not both.");
  }

  let title = typeof flags.title === "string" ? flags.title.trim() : "";
  let date = typeof flags.date === "string" ? flags.date.trim() : getTodayDate();
  let tags = typeof flags.tags === "string" ? parseTagsInput(flags.tags) : [];
  let slug = typeof flags.slug === "string" ? flags.slug.trim() : "";
  let draft = publishedFlag ? false : true;

  if (!useInteractive && (!title || tags.length === 0)) {
    throw new Error("Non-interactive create requires at least --title and --tags.");
  }

  if (useInteractive) {
    const rl = readline.createInterface({ input, output });

    try {
      title = title || (await promptRequiredText(rl, "Title"));
      date = flags.date ? date : await promptRequiredText(rl, "Date", getTodayDate());

      while (!isValidDateString(date)) {
        date = await promptRequiredText(rl, "Date", getTodayDate());
      }

      if (tags.length === 0) {
        tags = parseTagsInput(await promptRequiredText(rl, "Tags (comma-separated)"));
      }

      if (!slug) {
        slug = (await promptText(rl, "Slug (optional)", slugifyTitle(title))).trim();
      }

      if (!flags.draft && !flags.published) {
        draft = await promptYesNo(rl, "Create as draft?", true);
      }
    } finally {
      rl.close();
    }
  }

  if (slug && !isValidSlug(slug)) {
    throw new Error(`Invalid slug '${slug}'. Use lowercase letters, numbers, and dashes.`);
  }

  if (useInteractive && slug === slugifyTitle(title)) {
    slug = "";
  }

  const result = await createPost(cwd, {
    title,
    date,
    tags,
    slug,
    draft,
  });

  output.write(
    `Created ${result.draft ? "draft" : "published"} post '${result.slug}' at ${result.filePath}\n`,
  );
  return 0;
}

async function handleList({ cwd, flags, output }) {
  const posts = await readPosts(cwd);
  const filteredPosts = posts.filter((post) => {
    if (flags.drafts) {
      return post.draft;
    }

    if (flags.published) {
      return !post.draft;
    }

    return true;
  });

  if (filteredPosts.length === 0) {
    output.write("No posts found.\n");
    return 0;
  }

  const lines = [
    "STATUS     DATE        SLUG                       TITLE                      TAGS",
    "---------  ----------  -------------------------  -------------------------  ------------------------------",
  ];

  for (const post of filteredPosts) {
    const status = post.draft ? "draft" : "published";
    lines.push(
      [
        status.padEnd(9),
        post.date.padEnd(10),
        post.slug.padEnd(25),
        post.title.slice(0, 25).padEnd(25),
        post.tags.join(", "),
      ].join("  "),
    );
  }

  output.write(`${lines.join("\n")}\n`);
  return 0;
}

async function handleDraftState({ cwd, slug, draft, output }) {
  if (!slug) {
    throw new Error(`A slug is required for '${draft ? "draft" : "publish"}'.`);
  }

  const post = await setPostDraftState(cwd, slug, draft);
  output.write(`Updated '${post.slug}' to ${post.draft ? "draft" : "published"}.\n`);
  return 0;
}

async function handleDelete({ cwd, flags, slug, input, output, interactive }) {
  if (!slug) {
    throw new Error("A slug is required for 'delete'.");
  }

  const useInteractive = isInteractiveSession(input, output, interactive);

  if (!flags.yes) {
    if (!useInteractive) {
      throw new Error("Use --yes when deleting a post non-interactively.");
    }

    const rl = readline.createInterface({ input, output });
    try {
      const confirmed = await promptYesNo(rl, `Delete post '${slug}'?`, false);
      if (!confirmed) {
        output.write("Cancelled.\n");
        return 0;
      }
    } finally {
      rl.close();
    }
  }

  const filePath = await deletePost(cwd, slug);
  output.write(`Deleted ${filePath}\n`);
  return 0;
}

async function handleValidate({ cwd, output, error }) {
  const result = await validatePosts(cwd);

  if (result.issues.length > 0) {
    error.write(`Validation failed with ${result.issues.length} issue(s):\n`);
    for (const issue of result.issues) {
      error.write(`- ${issue}\n`);
    }
    return 1;
  }

  output.write(`Validated ${result.postCount} post(s) with no issues.\n`);
  return 0;
}

async function handleMigrateSlugs({ cwd, output }) {
  const renamePlan = await migratePostSlugs(cwd);
  const changed = renamePlan.filter((entry) => entry.changed);

  if (changed.length === 0) {
    output.write("No posts needed slug migration.\n");
    return 0;
  }

  output.write(`Migrated ${changed.length} post(s):\n`);
  for (const entry of changed) {
    output.write(`- ${entry.fromSlug} -> ${entry.toSlug}\n`);
  }
  return 0;
}

export async function runPostCli({
  argv,
  cwd = process.cwd(),
  input = process.stdin,
  output = process.stdout,
  error = process.stderr,
  interactive,
} = {}) {
  const [command = "help", ...rest] = argv ?? [];
  const { flags, positional } = parseArgs(rest);

  if (flags.help || command === "help") {
    output.write(`${getCommandHelp(command === "help" ? undefined : command)}\n`);
    return 0;
  }

  try {
    switch (command) {
      case "create":
        return await handleCreate({ cwd, flags, input, output, interactive });
      case "list":
        return await handleList({ cwd, flags, output });
      case "validate":
        return await handleValidate({ cwd, output, error });
      case "publish":
        return await handleDraftState({
          cwd,
          slug: resolveSlugArgument(flags, positional),
          draft: false,
          output,
        });
      case "draft":
        return await handleDraftState({
          cwd,
          slug: resolveSlugArgument(flags, positional),
          draft: true,
          output,
        });
      case "delete":
        return await handleDelete({
          cwd,
          flags,
          slug: resolveSlugArgument(flags, positional),
          input,
          output,
          interactive,
        });
      case "migrate-slugs":
        return await handleMigrateSlugs({ cwd, output });
      default:
        throw new Error(`Unknown command '${command}'.\n\n${GLOBAL_HELP}`);
    }
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    error.write(`${message}\n`);
    return 1;
  }
}

export async function runForTesting(options = {}) {
  const stdout = createWriter();
  const stderr = createWriter();
  const exitCode = await runPostCli({
    ...options,
    output: options.output ?? stdout.stream,
    error: options.error ?? stderr.stream,
  });

  return {
    exitCode,
    stdout: stdout.toString(),
    stderr: stderr.toString(),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const exitCode = await runPostCli({
    argv: process.argv.slice(2),
  });

  process.exitCode = exitCode;
}
