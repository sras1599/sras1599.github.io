# Repository Guidelines

## Core principle

Implement the simplest complete solution to the user's stated requirement.
Optimize for clarity and ease of change, not for hypothetical future needs.

## Scope

- Treat the user's current request as the source of truth.
- Make the smallest coherent change that satisfies it.
- Do not add adjacent features, generalized frameworks, or speculative extension points.
- Do not refactor unrelated code while completing a focused task.
- If a broader design would materially increase scope or complexity, ask before pursuing it.

## Design

- Prefer direct code and existing platform features over new abstractions.
- Add a dependency only when it provides clear value that would be unreasonable to implement locally.
- Avoid interfaces, adapters, factories, registries, and configuration layers with only one real use case.
- Keep logic close to its consumer until there is demonstrated reuse or the extraction clearly improves readability.
- Prefer a small function or a few explicit statements over a generic subsystem.
- Do not implement requirements that exist only in anticipated future work.

## Working with existing code

- Follow the repository's established conventions unless the user asks to change them.
- Preserve existing behavior outside the requested change.
- Respect user-authored and in-progress changes; do not overwrite or clean them up without permission.
- When documentation or an old task plan conflicts with the user's current direction, surface the conflict instead of silently expanding the work.

## Testing and verification

- Never run tests, even when a test suite exists.
- Do not introduce a test suite unless the user explicitly asks for one.
- Never verify changes yourself. Do not run builds, linters, type checks, previews,
  development servers, manual checks, or other verification commands.
- Do not tell the user merely to "test the changes." After making code changes,
  end the response with concise, concrete steps the user can follow to verify the
  affected behavior.
- Clearly state when no verification was performed, in accordance with these
  instructions.

## Code readability

- After changing code, format it according to the repository's established style.
- Keep code straightforward, consistently structured, and easy for the user to
  read.
- Add comments where they clarify intent, constraints, or non-obvious behavior.
  Do not add comments that merely restate the code.
- Module-level comments are encouraged when they help explain a module's purpose
  or important boundaries.

## Communication

- Be concise and concrete.
- Explain tradeoffs before introducing meaningful complexity.
- Ask for clarification only when different interpretations would materially change the result.
- If a simpler solution meets the requirement, prefer it and mention any limitation briefly.
