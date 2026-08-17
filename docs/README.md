# Spec-Driven Development with Superpowers

This guide documents how we use the [Superpowers](https://github.com/obra/superpowers)
skills to take a feature from *idea* to *merged code* in this repo. It covers the
**order** the skills run in and **what to pass to each one**.

Superpowers is a set of mandatory workflow skills. The agent checks for a relevant
skill before any task — these are workflows, not suggestions. You mostly just
describe what you want; the skills chain themselves. This doc is the map so you know
what's happening and where the artifacts land.

---

## The Pipeline at a Glance

```
  idea
   │
   ▼
┌───────────────────┐   design approved   ┌───────────────┐   plan written   ┌────────────────────────────┐
│  brainstorming    │ ──────────────────▶ │ writing-plans │ ───────────────▶ │ subagent-driven-development │
│  (spec)           │                     │ (plan)        │                  │   or executing-plans        │
└───────────────────┘                     └───────────────┘                  └────────────────────────────┘
                                                                                         │
        ┌────────────────────────────────────────────────────────────────────┐         │ per task
        │  runs *inside* execution:                                            │◀────────┘
        │   test-driven-development · requesting-code-review · receiving-...   │
        │   verification-before-completion                                     │
        └────────────────────────────────────────────────────────────────────┘
                                                                                         │ all tasks done
                                                                                         ▼
                                                                          ┌────────────────────────────────┐
                                                                          │ finishing-a-development-branch │
                                                                          └────────────────────────────────┘
```

Optional but recommended at the very start: **using-git-worktrees** to isolate the work.

---

## Step-by-Step: Order and Inputs

### 0. `using-git-worktrees` — *(optional, first)*

Isolate the feature in its own workspace so your current branch stays clean.

- **When:** before starting anything non-trivial, especially before executing a plan.
- **Pass it:** nothing formal — just consent ("yes, set up a worktree"). It detects
  whether you're already isolated and prefers the harness's native worktree tool.
- **Produces:** an isolated workspace on a feature branch.

### 1. `brainstorming` — turn an idea into a spec

The entry point for **any creative work** (new feature, component, behavior change).
It classifies the request into one of three paths and refines the idea through
dialogue.

- **When:** first, before any code. This is a hard gate — no implementation until you
  approve the design.
- **Pass it:** your idea / goal in plain language, plus context and constraints. Answer
  its clarifying questions.
- **Three paths it will pick (and say out loud):**
  - **Spike** — a feasibility question. Output is an *answer*, not kept code. No spec file.
  - **Bounded** — a small, well-scoped change to code that already exists here. Output is
    a short design *in chat*. No spec file.
  - **Architectural** — new project/subsystem or interface changes. Output is a written
    **spec**.
- **Produces (architectural path):** a spec at
  `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
  (Example already in this repo: `docs/superpowers/specs/2026-08-17-medleys-app-design.md`.)

### 2. `writing-plans` — turn the spec into an implementation plan

- **When:** after the spec/design is approved (architectural path).
- **Pass it:** the approved spec (path to the spec file, or the agreed design).
- **What it does:** maps which files change, decomposes work into **bite-sized tasks
  (2–5 min steps)** following DRY / YAGNI / TDD / frequent commits. Each task ends with
  an independently testable deliverable.
- **Produces:** a plan at `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`.
- **Note:** if the spec spans multiple independent subsystems, it asks to split into
  one plan per subsystem.

### 3. Execution — run the plan

Pick **one** of two execution skills:

| | `subagent-driven-development` | `executing-plans` |
|---|---|---|
| **Use when** | tasks are mostly independent and you stay in this session | you run the plan in a separate/parallel session, or subagents aren't available |
| **How** | dispatches a *fresh subagent per task* + two-stage review (spec compliance, then code quality) after each, plus a broad final review | loads the plan, reviews it critically, executes tasks in order with review checkpoints |
| **Pace** | continuous — doesn't stop between tasks; records rulings and keeps going | stops at checkpoints / on blockers |

- **Pass it:** the plan file path.
- **Stops only for:** irreversible/destructive ops, security-sensitive actions, side
  effects outside the worktree (merge/push/publish), or a plan too broken to proceed.

These sub-skills run **inside** execution — you don't invoke them separately:

- **`test-driven-development`** — the Iron Law: *no production code without a failing
  test first*. RED → GREEN → REFACTOR on every feature/bugfix/refactor.
- **`requesting-code-review`** — after each task and before merge. Pass the reviewer a
  description, the requirements/plan reference, and `BASE_SHA`..`HEAD_SHA`.
- **`receiving-code-review`** — how feedback is handled: verify against the codebase
  before implementing; push back with reasoning if a suggestion is wrong; ask when
  unclear. No performative "you're absolutely right."
- **`verification-before-completion`** — the Iron Law: *no completion claim without
  fresh verification evidence*. Every "tests pass" / "build works" is backed by a
  command run in the same message.

### 4. `finishing-a-development-branch` — integrate the work

- **When:** implementation complete and the full test suite is green.
- **Pass it:** confirmation of the base branch it forked from (it will ask if unsure).
- **What it does:** verifies tests → detects the git/worktree environment → presents
  merge/PR options → executes your choice → cleans up the worktree.

---

## What You Actually Type

You don't need to name every skill. In practice:

1. **"I want to build / change X."** → brainstorming starts, asks questions, presents a
   design, and (if architectural) writes the spec. **You approve.**
2. **"Write the plan."** → writing-plans produces the plan document. **You skim it.**
3. **"Execute the plan."** → subagent-driven-development (or executing-plans) runs it
   task by task, with TDD, reviews, and verification baked in.
4. **"Finish up."** → finishing-a-development-branch merges/PRs and cleans up.

Override the auto-classification whenever you disagree (e.g. "treat this as
architectural, write a spec"). When in doubt between two paths, Superpowers takes the
heavier one — and it only ratchets *up* mid-task, never down.

---

## Artifacts & Locations

| Artifact | Path | Created by |
|---|---|---|
| Spec / design | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | brainstorming (architectural) |
| Implementation plan | `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` | writing-plans |
| Code + tests | the app packages | execution + TDD |

## Related Repo Rules

Execution honors this project's own standards, defined in `.claude/rules/`:
`shared.md`, `backend.md`, `frontend.md`. The plan and TDD steps should produce code
that satisfies those rules (e.g. TDD-first, `pnpm --filter ... test`/`typecheck` green
before work is considered done).
