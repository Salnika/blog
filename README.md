# Design Blog with Dark Theme

This is a code bundle for Design Blog with Dark Theme. The original project is available at https://www.figma.com/design/bxfQ9zZ3htV0xQdBNGflYC/Design-Blog-with-Dark-Theme.

## Running the code

Run `vp install` to install the dependencies.

Run `vp dev` to start the development server.

## Posts

Posts live in `post/*.md` and use slug-based filenames such as `dual-attenuverter.md`.

Required frontmatter fields:

- `title`
- `date`
- `tags`

Optional frontmatter fields:

- `draft`

The markdown body is the post content.

## Post CLI

Use the local post workflow through `vp run`:

- `vp run post:create`
- `vp run post:list`
- `vp run post:validate`
- `vp run post:publish -- <slug>`
- `vp run post:draft -- <slug>`
- `vp run post:delete -- <slug>`
- `vp run post:migrate-slugs`

Examples:

- `vp run post:create -- --title "New Module" --date 2026-03-29 --tags "Modular, Synth"`
- `vp run post:list -- --drafts`
- `vp run post:publish -- dual-attenuverter`
- `vp run post:draft -- dual-attenuverter`
- `vp run post:validate`
- `vp run post:migrate-slugs`

Quality:

- Static checks: `vp check`
- Lint: `vp lint` / `vp lint --fix`
- Format: `vp fmt` / `vp fmt --check`
- Tests: `vp test`
- Unused files/exports: `vp run knip`
