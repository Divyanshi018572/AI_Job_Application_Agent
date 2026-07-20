<!-- BEGIN:git-workflow-rules -->
# Git Workflow & Commit Standards (`AI_Job_Application_Agent`)

## 1. Commit Message Conventions
- **One-Line Concise Commits**: Always write short, single-line commit messages following Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **No Verbose Bodies**: Avoid long, multi-paragraph commit bodies unless explicitly requested by the user. Example:
  - ✅ `feat: add career preferences tab and vertical sidebar to profile editor`
  - ✅ `fix: handle missing career_preferences column gracefully in profile API`
  - ❌ `feat: add career preferences... \n\nThis commit updates profile-editor.tsx with 8 new tabs...`

## 2. Branching & Pull Request Workflow
- **Never Commit Directly to `main`**: All feature development and bug fixes must occur on `dev` or dedicated feature branches (`feat/*`, `fix/*`).
- **Pull Request Creation**: When changes on `dev` are ready for integration into `main`, create a Pull Request with `@coderabbitai review` in the PR body to trigger automated code review before merging.
- **Atomic Checkpoints**: Commit changes in small, logical units (e.g., separate database schema migrations from UI refactors when feasible) so individual features can be cleanly reverted (`git revert <hash>`) if regressions occur.

## 3. Windows Environment Execution Invariance
- Due to Windows NUL device redirection restrictions inside the terminal sandbox (`Access is denied`), local read-only and non-remote-mutating `git` commands (`git add`, `git commit`) may be executed using `unsandboxed` action permissions when necessary.
- Remote-mutating operations (`git push`, `git fetch --prune`, `git pull --rebase`, etc.) must NOT be executed in unsandboxed mode by default. These commands require explicit user confirmation or should be provided to the user to run manually in PowerShell.
<!-- END:git-workflow-rules -->
