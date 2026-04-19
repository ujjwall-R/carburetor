# Feature Specification: Docker CLI and Wizard Integration

**Feature Branch**: `007-docker-cli-wizard-integration`  
**Created**: 2026-04-19  
**Status**: Draft  
**Input**: User description: "we have to extend the logic of single container flow to cli. Also remove the logic to ask directory in normal react app flow. use the default one only. for docker ask the neccessary things"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deploy Docker Container via Interactive Wizard (Priority: P1)

A developer runs the tool in interactive mode and wants to deploy a Docker-based single-container application. The wizard presents Docker as a project type option and collects the required information: Dockerfile path, EC2 instance ID, AWS credentials, and SSH key details. No VCS credentials or deploy directory is requested for Docker projects.

**Why this priority**: The interactive wizard is the guided entry point for users. Docker single-container deployment already works via `carburetor.yml`; exposing it through the wizard closes the gap so users can deploy Docker containers without writing a config file.

**Independent Test**: Can be tested by running `carburetor deploy --interactive`, selecting Docker as the project type, providing a Dockerfile path and EC2/AWS connection details, and verifying that the deployment proceeds without asking for VCS credentials or deploy directory.

**Acceptance Scenarios**:

1. **Given** the user launches interactive mode and selects Docker, **When** wizard steps are presented, **Then** the wizard collects: Dockerfile path, EC2 instance ID, AWS region, AWS access key, AWS secret key, SSH key (path or inline), and SSH username; no VCS token or deploy directory is requested.
2. **Given** the user provides an invalid Dockerfile path in the wizard, **When** they submit the prompt, **Then** the wizard shows an inline validation error and re-prompts for the path without exiting.
3. **Given** the user completes all Docker prompts and confirms the summary, **When** deployment begins, **Then** the full single-container pipeline executes and the wizard concludes with the accessible endpoint.
4. **Given** the user cancels the wizard at any Docker-specific prompt, **When** cancellation is triggered, **Then** the wizard exits cleanly without partial deployment.

---

### User Story 2 - React App Wizard Uses Default Deploy Directory (Priority: P2)

A developer runs the tool in interactive mode to deploy a React application. The wizard no longer asks for a deployment directory — it uses the standard web root silently. The wizard flow is shorter and less error-prone for React deployments.

**Why this priority**: The deploy directory prompt adds friction without value for React app deployments. The default is the correct answer for virtually every user, and asking for it introduces a source of misconfiguration.

**Independent Test**: Can be tested by running `carburetor deploy --interactive`, selecting React App, completing all prompts, and verifying that no deploy directory question appears and that the resulting deployment targets `/var/www/html`.

**Acceptance Scenarios**:

1. **Given** the user selects React App in interactive mode, **When** the wizard runs through all steps, **Then** no prompt for a deployment directory is shown.
2. **Given** the user completes a React app wizard session, **When** the deployment request is assembled, **Then** the deploy directory defaults to `/var/www/html` without the user specifying it.

---

### Edge Cases

- What happens when the Dockerfile path provided in the wizard does not exist at the time of validation?
- What happens if the user cancels partway through the Docker wizard steps?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST add Docker Single Container as a selectable project type in the interactive wizard.
- **FR-002**: System MUST collect the following in the Docker wizard path: Dockerfile path (with file-existence validation), AWS region, EC2 instance ID, AWS access key ID, AWS secret access key, SSH key (path or inline), and SSH username; system MUST NOT request VCS token or deploy directory for Docker projects.
- **FR-003**: System MUST display a confirmation summary before executing deployment in the Docker wizard path.
- **FR-004**: System MUST remove the deploy directory prompt from the React app interactive wizard path.
- **FR-005**: System MUST use `/var/www/html` as the deploy directory for React app wizard sessions.
- **FR-006**: System MUST validate that the Dockerfile path provided in the wizard exists on disk before assembling the deployment request.
- **FR-007**: System MUST always bind the Docker container to port 80; no port configuration is exposed to the user.

### Key Entities

- **Docker Wizard Session**: A guided interactive session that collects Docker-specific parameters and assembles a single-container deployment request using the same EC2/AWS infrastructure as the React app wizard.
- **React Wizard Session**: The existing guided interactive session for React app deployments, now without the deploy directory prompt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Docker interactive wizard path collects all required information in 8 or fewer prompts (project type, Dockerfile path, region, instance ID, AWS keys ×2, SSH key, SSH user) with no VCS-related questions and no port prompt.
- **SC-002**: The React app interactive wizard path is reduced by exactly one prompt compared to the current implementation (deploy directory removed).
- **SC-003**: An invalid Dockerfile path is caught and reported inline in the wizard before any deployment begins — no partial pipeline run occurs.
- **SC-004**: A Docker container deployed via the wizard is reachable on port 80 within 60 seconds of the wizard reporting success.

## Assumptions

- The single-container Docker pipeline is already implemented in the engine and access layers; this feature only adds wizard support.
- The Docker wizard uses the same EC2 instance ID + AWS credential path as the React app wizard — no direct SSH host/IP mode is added.
- Port 80 is the fixed binding for all single-container deployments; no user configuration of the port is exposed.
- The React app default deploy directory `/var/www/html` is correct for all wizard-initiated React deployments.
