# mihirrao-10.github.io

Mihir Rao's framework-free personal website. GitHub Pages serves the repository
root from `main`; the production site therefore keeps real directories and
relative links instead of client-side routing.

It links to **The Shortest Path Through a Curved World** at
[`/shortest-path-through-a-curved-world/`](https://mihirrao-10.github.io/shortest-path-through-a-curved-world/),
a guided Heat Method story backed by a standalone C++20 CPU geometry engine on
a generated toroidal mesh. That implementation, its exported numerical data,
and its Pages workflow live in the sibling
`shortest-path-through-a-curved-world` repository.

The Personal Projects section also links to **When Every Agent Finds the
Shortcut** at
[`/multi-agent-reinforcement-learning-in-congestion-games/`](https://mihirrao-10.github.io/multi-agent-reinforcement-learning-in-congestion-games/),
an exact atomic Braess-game study with deterministic multi-agent learning
experiments and an interactive Three.js potential landscape. Its Python
analysis, exported story data, web experience, tests, and Pages workflow live
in the sibling `multi-agent-reinforcement-learning-in-congestion-games`
repository.

## Repository layout

```text
index.html  personal-site homepage
assets/     shared static assets
notes/      published course-note PDFs
dist/       ignored production-build output
```

## Local development

```sh
npm ci
npm run build
python3 -m http.server 8000 -d dist
```

## Course notes

`notes/` holds generated PDFs only. The LaTeX sources live in the sibling
`web/course-notes/` project. Do not edit the PDFs here by hand. Run
`make publish` from `course-notes/` to rebuild, verify that course directories,
published PDFs, and homepage links agree, and copy the files here. Adding a
course also requires one `<li>` in the homepage `notes-list`; `make check`
detects missing or extra links.
