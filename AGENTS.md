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
- Prefer established, library-owned solutions for standard problems such as schema
  validation, parsing, and serialization, especially when the library is already
  available in the project. Write a custom solution only when the library's cost
  or constraints clearly outweigh its reliability and maintenance benefits.
- Add a focused dependency when it provides a clearer, more reliable, or more
  maintainable solution than implementing the same capability locally; consider
  its security, runtime, and bundle-size costs before adding it.
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

Optimize for a reader understanding the behavior in one continuous read,
with minimal jumping between definitions.

### Flow and expressions

- Write operations in the order you would explain the task: establish inputs,
  handle exceptional cases, perform the main work, produce the result.
- Prefer early returns when they reduce nesting and clarify the normal path.
- Give distinct decisions their own statements. Avoid nested ternaries and
  expressions that combine several business rules.
- Use intermediate variables when they name a meaningful concept or explain
  an expression; avoid aliases that add no meaning.
- Separate distinct logical steps with blank lines.
- Follow the repository's established formatting style.

### Functions and boundaries

- Keep related logic together. Extract a helper when it names a meaningful
  operation, hides substantial detail, or removes meaningful duplication.
- Do not split cohesive functions merely to make them shorter. Avoid helpers
  that force navigation without making the caller easier to understand.
- Make each file responsible for a coherent part of the behavior. Do not use
  arbitrary function-length or file-length limits.
- Use names that describe domain meaning and actual behavior. Make filesystem
  access, persistence, and significant mutation apparent through names and
  explicit inputs or outputs.

### Data flow

- Prefer explicit inputs and returned results over mutations that silently
  prepare shared objects for later functions.
- Local mutation is fine. When shared mutation is necessary, make ownership
  and the mutation contract clear.
- Avoid generic context objects that mix lookup data, mutable working state,
  and accumulated outputs. Group values by a clear shared purpose.
- Keep return shapes predictable. For example, a transformation that can
  produce multiple nodes should consistently return an array of nodes.
- Store only data used by the current implementation. Do not add unused
  fields, discriminator tags, or intermediate representations for future work.

### Errors and explanations

- Catch only failures the code can handle meaningfully. Do not turn unexpected
  errors into success-shaped defaults.
- Include the affected input and useful context in error messages.

### Comments and documentation

- Default to descriptive comments when generating or changing code. Favor enough
  explanation for the user's first read; the user can shorten comments later.
  Concise communication does not mean sparse code comments.
- Every code module must begin with a descriptive module-level comment. Explain
  why the module exists, its main inputs and outputs, the main stages of its
  workflow, and important boundaries or side effects. Define domain terms that
  a reader needs to understand the file. Update this comment when changing the
  module's responsibilities or behavior.
- Introduce nontrivial functions with comments explaining their role, meaningful
  inputs and return values, and relevant mutations, assumptions, or failure
  behavior. A reader should not have to trace callers to discover the contract.
- Within complex functions, explain the purpose of each meaningful phase and
  the rules behind non-obvious branches. Describe ordering dependencies,
  precedence, fallback behavior, and exceptional cases where they matter.
- Use small examples when they clarify a transformation, path convention,
  data shape, or domain rule more effectively than an abstract description.
- Comments may explain what an algorithm does as well as why it exists. Avoid
  mechanical narration of obvious syntax, but do not omit useful explanation
  just because a reader could eventually infer it from the implementation.
- Keep comments accurate and specific to the implemented behavior, including
  its limitations. Do not use comments to compensate for misleading names or
  unnecessarily complicated code, or remove useful detail solely for brevity.

## Communication

- Be concise and concrete.
- Explain tradeoffs before introducing meaningful complexity.
- Ask for clarification only when different interpretations would materially change the result.
- If a simpler solution meets the requirement, prefer it and mention any limitation briefly.
