# Feature Specification: Interactive Deployment Wizard

**Feature Branch**: `004-interactive-wizard`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User description: "interactive CLI wizard mode — user gets dropdowns and form elements to configure a deployment interactively when running carborator with a specific flag. Project type, VCS, CSP, service, and all credentials/env vars collected one by one with validation. All UX choices encapsulated in the Client layer."

## Overview

Today, deploying with `carborator` requires a pre-authored `carborator.yml` config file and manually exported environment variables. This creates friction for first-time users and ad-hoc deployments. This feature adds an **interactive wizard mode** triggered by a flag that guides the user through every deployment decision via sequential terminal prompts — selecting the project type, version-control provider, cloud platform, service type, and entering all required credentials one by one. The wizard assembles the same deployment request that the config-file path produces and hands it directly to the deployment flow. All wizard choices (which project types, VCS providers, cloud platforms, and service types to offer) are owned entirely by the Client layer, keeping the Manager and Engine layers free of presentation-layer concerns.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Complete Interactive Deployment (Priority: P1)

A developer who has never set up a `carborator.yml` runs `carborator deploy --interactive`. They are walked through a wizard that asks for their project type, VCS details, cloud target, and credentials step by step. At the end, the deployment runs exactly as if they had provided a config file.

**Why this priority**: This is the primary value of the wizard — enabling a deployment from zero config. All other user stories depend on or extend this flow.

**Independent Test**: A user can run `carborator deploy --interactive`, answer every prompt, and observe a successful deployment (or validated dry-run) with zero `carborator.yml` present.

**Acceptance Scenarios**:

1. **Given** no `carborator.yml` exists, **When** the user runs `carborator deploy --interactive`, **Then** the wizard starts and presents the first prompt (project type selection).
2. **Given** the wizard is running, **When** the user selects React App and completes all remaining prompts, **Then** the deployment executes and the outcome is displayed identically to a file-based deployment.
3. **Given** the wizard is running, **When** the user provides an invalid value for a credential field, **Then** the wizard rejects the input, displays a specific error message, and re-prompts the same field.
4. **Given** the wizard completes successfully, **When** the deployment fails at the manager level, **Then** the wizard surfaces the same error output as the non-interactive path.

---

### User Story 2 — Step-by-Step Credential Collection (Priority: P2)

During the wizard, after selecting the CSP and service, the user is prompted for each required credential key individually. Each key has a label, is validated on entry (non-empty, format checks where applicable), and masked for secrets.

**Why this priority**: Credentials are the most error-prone part of config setup. Per-field prompts with inline validation eliminate the "missing env var" errors that currently surface only at runtime.

**Independent Test**: Can be fully tested by running the wizard to the credential section, entering an empty value for a required key, and confirming the wizard rejects it and re-prompts — without any deployment occurring.

**Acceptance Scenarios**:

1. **Given** the user has selected AWS as the CSP, **When** the credential prompts appear, **Then** the wizard asks for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as separate, labeled prompts with masked input.
2. **Given** the user leaves a required credential field blank, **When** they press Enter, **Then** the wizard displays "This field is required" and repeats the same prompt.
3. **Given** the user has selected EC2 as the service, **When** the SSH credential prompts appear, **Then** the wizard offers a choice between providing an inline SSH key or a file path to a key, and asks for the SSH user and deploy directory separately.
4. **Given** all credentials are entered, **When** the user completes the wizard, **Then** the values are passed to the deployment flow and are never printed to the terminal in plain text.

---

### User Story 3 — Wizard Dry-Run Mode (Priority: P3)

A user who wants to verify their interactive inputs without deploying runs `carborator deploy --interactive --dry-run`. The wizard collects all inputs and then runs credential validation only, reporting pass/fail for each credential.

**Why this priority**: Mirrors the existing `--dry-run` flag for the file-based path; ensures the interactive path is equally safe for pre-flight checks.

**Independent Test**: Run `carborator deploy --interactive --dry-run`, complete the wizard, and verify the output shows credential validation results with no deployment performed.

**Acceptance Scenarios**:

1. **Given** the user runs `carborator deploy --interactive --dry-run`, **When** all prompts are answered, **Then** the system prints credential validation results and exits 0 on success — no deployment is performed.
2. **Given** the user provides invalid credentials in the wizard, **When** dry-run validation runs, **Then** the system prints specific error messages per credential and exits 1.

---

### Edge Cases

- What happens if the user presses Ctrl-C mid-wizard? — Wizard exits cleanly with a cancellation message and exit code 1; no partial deployment is triggered.
- What happens if the user selects "Other" (placeholder project type)? — Wizard proceeds with a generic build configuration and notifies the user that this type is experimental.
- What happens if the user runs `--interactive` together with `--config`? — The config file takes precedence; `--interactive` is ignored and a warning is printed.
- What happens if a field's validation rule is not met after 3 consecutive attempts? — Wizard exits with a helpful error message directing the user to the documentation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `carborator deploy` MUST accept a new `--interactive` flag that, when present, activates the wizard mode instead of requiring a config file.
- **FR-002**: The wizard MUST present a project-type selection prompt offering at least "React App" and one additional placeholder option; only one option can be chosen at a time.
- **FR-003**: The wizard MUST present a VCS-provider selection prompt offering "GitHub" as the available option; the user must also provide a repository URL and branch name via text prompts.
- **FR-004**: The wizard MUST present a cloud-platform selection prompt offering "AWS" as the available option.
- **FR-005**: After selecting a cloud platform, the wizard MUST present a service-type selection prompt; for AWS, "EC2 Instance" MUST be the available option.
- **FR-006**: The wizard MUST collect each required credential as a separate, labeled prompt with masked input; credentials MUST be validated as non-empty before proceeding.
- **FR-007**: For EC2 deployments, the wizard MUST ask for the SSH key (inline text or file path — user's choice), SSH username, and deployment directory as individual prompts.
- **FR-008**: The wizard MUST display a summary of all non-secret selections before proceeding to deployment, with a confirmation prompt allowing the user to abort.
- **FR-009**: Upon confirmation, the wizard MUST assemble a deployment request and pass it to the same deployment flow used by the file-based path — the Manager and Engine layers MUST NOT be modified for this feature.
- **FR-010**: The wizard MUST handle Ctrl-C at any point by exiting cleanly without triggering a deployment.
- **FR-011**: All wizard prompt logic, menu options, and choice sets MUST reside in the Client layer; the Manager MUST receive only a fully assembled deployment request.
- **FR-012**: The `--interactive` flag MUST be compatible with `--dry-run`; when both are present, the wizard collects inputs and then executes credential validation only.
- **FR-013**: If `--interactive` is used alongside `--config`, the wizard MUST be skipped, the config file loaded normally, and a warning printed to stderr.

### Key Entities

- **Wizard Session**: The in-progress interactive configuration, holding the user's selections and entered values as they move through prompts. Discarded on completion or cancellation — never persisted.
- **Prompt Definition**: A descriptor for a single wizard step: label, input type (selection / text / secret), available choices (for selections), and validation rule.
- **Deployment Request**: The assembled output of a completed wizard session; identical in structure to the request produced by the config-file path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with no `carborator.yml` can complete an interactive deployment in under 3 minutes from running the flag to seeing the deployment outcome.
- **SC-002**: 100% of required credential fields are validated before the deployment request is submitted — zero "missing env var" errors occur at runtime for interactively collected credentials.
- **SC-003**: All wizard menu choices (project types, VCS providers, CSP platforms, service types) are defined exclusively in the Client layer; zero wizard-specific choice logic exists in Manager or Engine files.
- **SC-004**: The Manager and Engine source files are unmodified by this feature (diff shows zero changes to those files).
- **SC-005**: The existing file-based deploy path (`carborator deploy -c carborator.yml`) produces identical results before and after this feature is added.
- **SC-006**: Running `carborator deploy --interactive --dry-run` produces a credential-validation report without performing a deployment.

## Assumptions

- The `--interactive` flag is added to the existing `deploy` subcommand rather than as a new top-level command; this avoids breaking any existing CLI automation.
- Only the options explicitly stated (React + 1 dummy, GitHub, AWS, EC2) are presented in the initial release; the architecture accommodates future option expansion without code changes outside the Client layer.
- Interactive prompts are rendered in the terminal using standard stdin/stdout — no GUI, no web UI, no TUI framework requiring additional runtime dependencies is assumed (a lightweight prompt library may be used if it adds no heavy transitive deps).
- Credentials collected interactively are held in memory only for the duration of the wizard session and the subsequent deployment call; they are not written to disk.
- The VCS token (GitHub personal access token) is treated as a secret and masked during input.
- Region and environment (e.g., "us-east-1", "production") are collected as free-text prompts for now, not as dropdowns, since the valid set is large and not hardcoded.
- The resource ID (e.g., EC2 instance ID) is collected as a free-text prompt; the wizard does not list or discover cloud resources.
