# Carborator

## Tech Stack

- **Language**: TypeScript
- **Runtime / Package Manager**: Bun
- **Output**: CLI tool (`bun build --compile` for single executable)
- **Design Paradigm**: Object-oriented — each layer component (Manager, Engine, ResourceAccess) is a class or better each layer is a module inside which each one-eg Engine is a class. Interface will be exposed to layers above. We will use Jenkins for now as running the workflow scripts.

---

# System Design Principles
## Based on "The Method" by Juval Löwy

---

## Core Philosophy

- Avoid functional decomposition. A good system design speaks through how components interact.
- The client should not be the core business. Let the client be the client — not the system.
- **Decompose based on volatility**, not functionality.
- Design iteratively, build incrementally.

---

## Identifying Volatilities

- List the requirements, then identify volatilities using two independent axes:
  - **Time axis**: What can change for existing customers over time?
  - **Customer axis**: Keeping time constant, what differs across customers / use cases?
- There is rarely a one-to-one mapping between a volatility area and a component.
- Verify that a solution/component is not masquerading as a requirement.
- A volatility is **not** something handled with if-else — that is variability, not volatility.

---

## Layered Architecture

Four layers, each answering a distinct question:

| Layer | Question | Naming Convention |
|---|---|---|
| **Client** | Who interacts with the system? | — |
| **Manager** | What is required of the system? | `<NounOfVolatility>Manager` |
| **Engine** | How does the system perform business logic? | `<Gerund>Engine` |
| **ResourceAccess** | How does the system access resources? | `<NounOfResource>Access` |
| **Resource** | Where is the system state? | — |

- Naming must be descriptive. Avoid atomic business verbs in service names.
- Atomic verbs belong only in **operation names**, not service names.
- Volatility **decreases** top to bottom; reusability **increases** top to bottom.

---

## Scale & Ratio Rules

- **Manager:Engine golden ratio** — valid ratios: `1:(0 or 1)`, `2:1`, `3:2`, `5:3`
- More than **5 Managers**? You are likely going wrong.
- A **slice** is a subsystem. No more than **3 Managers** per subsystem.
- A good architecture integrates ~**10–20 components** to support core use cases composably.
- Features are outcomes of integration, not implementation.

---

## Design Don'ts

- A **Client must not** call multiple Managers for a single use case.
- A **Client must not** call Engines directly.
- **Managers must not** queue calls to more than one Manager in the same use case. If multiple Managers need to respond, use a **Pub/Sub Utility** service instead.
- **Engines and ResourceAccess** services do not receive queued calls.
- **Clients, Engines, ResourceAccess, and Resources** do not publish events.
- **Engines, ResourceAccess, and Resources** do not subscribe to events — only Clients or Managers do.
- **Engines never call each other.**
- **ResourceAccess services never call each other.**

## Active Technologies
- TypeScript 5.x (strict mode) + `commander` (CLI parsing), cloud SDKs (aws-sdk v3, @google-cloud/*, @azure/*) (001-deployment-cli)
- N/A — stateless per invocation; config sourced from `carborator.yml` (001-deployment-cli)
- TypeScript 5.x (strict mode) + `commander` (CLI parsing), cloud SDKs (aws-sdk v3, @google-cloud/*, @azure/*) (001-deployment-cli)
- TypeScript 5.5 (strict mode) (ujjwal/baseSetup)
- TypeScript 5.5 (strict mode) + `commander` (CLI parsing); no new dependencies (ujjwal/baseSetup)
- N/A — stateless refactor (ujjwal/baseSetup)

## Recent Changes
- 001-deployment-cli: Added TypeScript 5.x (strict mode) + `commander` (CLI parsing), cloud SDKs (aws-sdk v3, @google-cloud/*, @azure/*)
