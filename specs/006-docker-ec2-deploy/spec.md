# Feature Specification: Single Image Docker EC2 Deployment

**Feature Branch**: `006-docker-ec2-deploy`  
**Created**: 2026-04-18  
**Status**: Draft  
**Input**: User description: "I want to develop the deployment for single image applications. If a user gives a dockerfile path, our tool will use the path to spin the container in the ec2. So basically a flow like Build image locally → Export image to a file → Transfer to EC2 → Load image on EC2 → Run container. The customer will decide the docker file. we just expose port."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deploy Application from Dockerfile (Priority: P1)

A developer has a single-service application with a Dockerfile and a provisioned EC2 instance. They invoke the deployment tool with their Dockerfile path, EC2 connection details, and the port to expose. The tool handles the entire lifecycle: building the image, packaging it, transferring it to the remote machine, and starting the container — all without the developer needing to manually SSH or run Docker commands.

**Why this priority**: This is the core value of the feature. Without this story, nothing else is possible.

**Independent Test**: Can be fully tested by running the deployment command with a minimal Dockerfile (e.g., a simple HTTP server), an accessible EC2 instance, and verifying the container is reachable on the exposed port after the command completes.

**Acceptance Scenarios**:

1. **Given** a valid Dockerfile path and reachable EC2 instance, **When** the user runs the deploy command with the Dockerfile path, host, SSH key, and port, **Then** the tool builds the image locally, exports it to a file, transfers it to the EC2 instance, loads it, starts the container, and reports success with the accessible endpoint.
2. **Given** the Dockerfile build fails, **When** the tool attempts to build the image, **Then** the tool stops and reports a clear build failure message with the underlying error — no transfer or EC2 operations are attempted.
3. **Given** the EC2 instance is unreachable, **When** the tool attempts to transfer the image, **Then** the tool reports a connection failure and cleans up any locally created image file.

---

### User Story 2 - Monitor Deployment Progress (Priority: P2)

A developer wants to observe what the tool is doing at each stage of the deployment so they can diagnose problems and understand timing.

**Why this priority**: Multi-step operations that involve remote machines and large file transfers will fail in non-obvious ways. Visibility into each stage reduces support burden and debugging time.

**Independent Test**: Can be tested by running any deployment and verifying that stage-by-stage progress output is printed to the terminal (e.g., "Building image…", "Exporting image…", "Transferring to EC2…", "Loading image…", "Starting container…").

**Acceptance Scenarios**:

1. **Given** a deployment is running, **When** each stage begins and completes, **Then** the tool outputs a progress message to the terminal indicating which stage is active.
2. **Given** a stage fails, **When** the error occurs, **Then** the tool prints an informative error message that identifies the failed stage and the underlying cause.

---

### User Story 3 - Redeploy Over an Existing Container (Priority: P3)

A developer re-runs the deployment command after making changes to their application. If a container is already running on the target port, the tool should replace it gracefully without manual intervention.

**Why this priority**: Redeployment is a natural follow-up to first deployment. Without this, users must manually stop and remove old containers, undermining the tool's automation value.

**Independent Test**: Can be tested by running the deploy command twice against the same EC2 instance and port, then verifying the second run completes without error and the new container is running.

**Acceptance Scenarios**:

1. **Given** a container is already running on the specified port, **When** the user re-runs the deploy command, **Then** the tool stops the existing container, loads the new image, and starts a fresh container on the same port.
2. **Given** no existing container is running on the port, **When** the user runs the deploy command, **Then** the tool proceeds normally without attempting to stop anything.

---

### Edge Cases

- What happens when the local machine runs out of disk space during image export?
- How does the tool behave when the SSH transfer is interrupted mid-file?
- What happens when the specified port is already in use by a non-managed process on EC2?
- What happens when Docker is not installed on the target EC2 instance?
- What happens when the Dockerfile path does not exist or is not a valid Dockerfile?
- How does the tool handle very large images (e.g., multi-GB) during export and transfer?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a Dockerfile path as a required input and validate that the file exists before beginning the deployment pipeline.
- **FR-002**: System MUST build a Docker image from the provided Dockerfile path on the local machine.
- **FR-003**: System MUST export the built image to a compressed archive file on local disk.
- **FR-004**: System MUST transfer the exported image file to the target EC2 instance over SSH using a user-provided SSH key and host address.
- **FR-005**: System MUST load the transferred image on the EC2 instance.
- **FR-006**: System MUST start a container from the loaded image on the EC2 instance, binding the user-specified container port to a host port.
- **FR-007**: System MUST stop and remove any existing container on the same host port before starting the new one during a redeployment.
- **FR-008**: System MUST clean up the local image export file after a successful or failed transfer.
- **FR-009**: System MUST report the publicly accessible address (host + port) upon successful deployment.
- **FR-010**: System MUST accept the following inputs: Dockerfile path, EC2 host/IP, SSH username, SSH private key path, and port to expose.
- **FR-011**: System MUST abort and report clearly at the first stage that fails, without proceeding to subsequent stages.

### Key Entities

- **Deployment**: A single invocation of the tool representing the full pipeline run — tracks Dockerfile path, target host, port, and outcome.
- **Image Archive**: The temporary file produced by exporting the local Docker image; exists only for the duration of a deployment pipeline run.
- **Target Instance**: The EC2 machine identified by host address, SSH username, and SSH key; the destination for the image and the runtime environment for the container.
- **Container**: The running process on the EC2 instance started from the loaded image, bound to the specified host port.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with a valid Dockerfile and accessible EC2 instance can complete a full deployment in a single command invocation, with no manual SSH or Docker steps required.
- **SC-002**: The deployed container is reachable on the exposed port within 60 seconds of the tool reporting success.
- **SC-003**: A re-deployment to the same instance replaces the running container without downtime exceeding the time required to stop, load, and restart — no manual cleanup needed.
- **SC-004**: The tool reports a clear, stage-specific error message for every failure mode, enabling a developer to identify and resolve the issue without reading source code.
- **SC-005**: The local disk is returned to its pre-deployment state (no orphaned image archives) after every deployment, successful or failed.

## Assumptions

- The target EC2 instance is already provisioned, running, and reachable via SSH on the standard port (22) at the time of deployment.
- Docker is already installed and running on the target EC2 instance.
- Docker is already installed and running on the local machine performing the deployment.
- The SSH user has sufficient permissions on the EC2 instance to load Docker images and start/stop containers.
- The tool manages one container per port; containers started by other means are out of scope for lifecycle management.
- Image naming within the pipeline is handled internally by the tool; the user does not need to specify an image tag.
- The tool exposes exactly one port per deployment (single container, single port binding); multi-port or multi-container configurations are out of scope.
- Network-level access (security groups, firewall rules) on the EC2 instance to allow inbound traffic on the exposed port is the user's responsibility and is out of scope.
