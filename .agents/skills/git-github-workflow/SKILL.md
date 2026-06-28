---
name: git-github-workflow
description: Set up and guide safe Git and GitHub workflows for repositories and portfolio projects. Use for repository initialization, status review, branches, staging, commits, remotes, pushes, pull requests, README creation, collaboration, meaningful commit messages, and diagnosis of common Git errors.
---

# Git and GitHub Workflow

Use a safe, beginner-friendly workflow that preserves existing work and produces an understandable history.

## Safety First

1. Inspect the repository root, current branch, remotes, and `git status` before changing anything.
2. Preserve unrelated or pre-existing modifications.
3. Do not use destructive reset, checkout, clean, force-push, or history rewriting unless the user explicitly requests and understands it.
4. Do not commit secrets, local environment files, generated build output, or large dependency folders.
5. Ask for the repository URL when a push is requested and no remote exists.

## Beginner Workflow

Explain each command in one short line and adapt it to repository state:

```bash
git init
git status
git add <intended-files>
git commit -m "feat: describe the completed change"
git branch -M main
git remote add origin <repository-url>
git push -u origin main
```

Use feature branches for later work:

```bash
git switch -c feature/short-name
```

Stage intentionally rather than assuming every changed file belongs in one commit. Verify the staged diff before committing.

## Portfolio README

Include project title, problem and solution, features, technology, architecture/folder structure, setup, configuration, run/test commands, screenshots, database design, security notes, documentation links, future improvements, author, and license. Do not claim tests, screenshots, deployment, or features that do not exist.

## Troubleshooting

Diagnose before suggesting commands. Explain common issues such as wrong repository directory, missing identity, existing remote, rejected non-fast-forward push, ignored files, line-ending warnings, or authentication failure. Prefer reversible fixes.
