# mihirrao-10.github.io

Mihir Rao's personal site: a single static `index.html` with no framework, no
build step, and no dependencies. GitHub Pages serves the root of `main`, so a
push is a deploy.

```text
index.html        the whole page, styles inline
assets/images/    profile art
notes/            published course note PDFs
```

## Notes

`notes/` holds **generated PDFs only**. The LaTeX sources live outside this
repository, in:

```text
~/Documents/Personal Projects/web/course-notes/
```

Each PDF is named for the course directory it was built from, so the two map
one to one. Do not edit anything in `notes/` by hand. To republish, run
`make publish` from `course-notes/`, which rebuilds every course, verifies that
`courses/`, `notes/`, and the links in `index.html` all agree, and copies the
PDFs across. Then commit and push here.

Adding a course means adding one `<li>` to the `notes-list` in `index.html`;
`make check` fails if a published PDF has no link, or a link has no PDF.
