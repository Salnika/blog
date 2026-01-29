# Design Blog with Dark Theme

This is a code bundle for Design Blog with Dark Theme. The original project is available at https://www.figma.com/design/bxfQ9zZ3htV0xQdBNGflYC/Design-Blog-with-Dark-Theme.

## Running the code

Run `bun install` to install the dependencies.

Run `bun run dev` to start the development server.

## Posts

Posts live in `post/*.md` with required frontmatter fields:

- `title`
- `date`
- `tags`

The markdown body is the post content.

Quality:

- Lint: `bun run lint` / `bun run lint:fix`
- Format: `bun run fmt` / `bun run fmt:check`
- Unused files/exports: `bun run knip`
