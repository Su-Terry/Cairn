# Cairn

> Stop your AI coding agent from creating `train_v3_final_FINAL.py`.

Cairn is a VS Code extension that marks every experiment with a stable waypoint—linking code, results, and intent—so you can find your way back when Claude Code or Cursor have been doing most of the typing.

## Status

🚧 Early development. Not yet usable. Watch this repo for updates.

## Why

When AI coding agents drive most of the implementation, they tend to fork
new scripts every time you try a new method—`train.py`, `train_v2.py`,
`train_actually_works.py`—without leaving a clear stable version behind.
Experiment results end up scattered across logs, W&B runs, and chat
histories with the agent itself, making it slow to find what you need
when writing weekly reports or papers. Cairn exists because I got tired
of archaeology being part of my research workflow.

## Roadmap

- [ ] Experiment browser (VS Code side panel)
- [ ] Auto-link experiments to git commits
- [ ] Figure attachment & preview
- [ ] LaTeX macro for paper integration

## License

MIT
