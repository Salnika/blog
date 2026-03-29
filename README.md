# Design Blog with Dark Theme

This is a code bundle for Design Blog with Dark Theme. The original project is available at https://www.figma.com/design/bxfQ9zZ3htV0xQdBNGflYC/Design-Blog-with-Dark-Theme.

## Running the code

Run `vp install` to install the dependencies.

Run `vp dev` to start the development server.

## Posts

Posts live in `post/*.md` with required frontmatter fields:

- `title`
- `date`
- `tags`

The markdown body is the post content.

Quality:

- Static checks: `vp check`
- Lint: `vp lint` / `vp lint --fix`
- Format: `vp fmt` / `vp fmt --check`
- Tests: `vp test`
- Unused files/exports: `vp run knip`
