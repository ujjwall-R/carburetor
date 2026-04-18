# Research: Single Image Docker EC2 Deployment

**Feature**: `006-docker-ec2-deploy`  
**Phase**: 0 — Pre-design research  
**Date**: 2026-04-18

---

## Decision 1: Docker Image Naming

**Decision**: Use a fixed, stable image name — `carburetor-docker-image` — on both the local machine and the EC2 instance.

**Rationale**: Redeployment requires stopping the existing container and loading the new image. A stable name means the Ship "stop" step can always reference `carburetor-docker-image` without needing state from the previous run. Timestamp-based names create image accumulation and require side-channel state tracking.

**Alternatives considered**:
- Timestamped tags (e.g., `carburetor-image:20260418-143022`) — rejected: would require storing the tag somewhere to reference it during container stop; creates image bloat on EC2.
- User-supplied image name — rejected for MVP; adds surface area without spec requirement.

---

## Decision 2: Port Binding — Container Port vs. Host Port

**Decision**: A single port value is used for both the container port and the EC2 host port (`-p PORT:PORT`).

**Rationale**: The spec states "we just expose port" and "the customer will decide." A single port minimises user input. The overwhelming majority of single-image apps default to the same port internally and externally. Separate mapping can be added in a follow-up if needed.

**Alternatives considered**:
- Separate `--container-port` / `--host-port` flags — rejected: over-engineers MVP; not in the spec.

---

## Decision 3: Docker Build Context

**Decision**: Use the directory containing the Dockerfile as the build context (i.e., `path.dirname(dockerfilePath)`).

**Rationale**: The Docker convention is to use the Dockerfile's directory as context. The user may reference files in sibling paths within the project. Using `dirname` follows the principle of least surprise.

**Alternatives considered**:
- Require user to separately specify a build context directory — rejected for MVP; the spec asks for a Dockerfile path only.
- Use the current working directory as context — rejected: breaks when Dockerfile lives in a subdirectory.

---

## Decision 4: Artifact Path for Docker Image Export

**Decision**: The Docker Package step exports to `<artifactDir>/image.tar.gz` using `docker save | gzip`. The `Pipeline` model gains an optional `artifactPath` field that `DockerOrchestration` sets, and `LocalPipelineExecutor` reads.

**Rationale**: The existing `LocalPipelineExecutor` hardcodes the artifact to `join(context.sourceDir, 'artifact.tar.gz')`. For Docker, the image tar must be in `artifactDir` (a temp dir distinct from sourceDir). Introducing `Pipeline.artifactPath` keeps the change minimal and backward-compatible — all existing orchestrations leave it unset and fall through to the current default.

**Alternatives considered**:
- Scan `artifactDir` for any `.tar.gz` — rejected: fragile if the build step creates intermediate tarballs.
- Change all orchestrations to write to `artifactDir` — rejected: unnecessarily wide change for this feature.

---

## Decision 5: VCS Bypass for Local Dockerfile Deployments

**Decision**: When `BuildConfig.dockerfilePath` is set and the project type is `Docker`, `ShippingEngine.run` skips the VCS fetch and uses `path.dirname(dockerfilePath)` as `sourceDir`.

**Rationale**: The Docker feature is fundamentally different from VCS-sourced deployments — the user has a local Dockerfile, not a remote git repo. Adding a VCS fetch step would require every Docker user to configure a git remote, which contradicts the spec's intent. The bypass is conditioned on `dockerfilePath` being present so existing VCS flows are unaffected.

**Alternatives considered**:
- Introduce a "local" VCS provider that returns the local path — rejected: adds an artificial layer that obscures intent.
- Make `VCSConfig` fully optional across the board — rejected: too wide a change; out of scope.

---

## Decision 6: Container Management (Redeployment)

**Decision**: The Ship step sequence includes a stop/remove command before running the new container: `docker rm -f carburetor-app 2>/dev/null || true`. The container is always named `carburetor-app`.

**Rationale**: This matches FR-007 (stop existing container before starting new one). The `|| true` ensures the step doesn't fail when no container is currently running (first deployment). Fixed container name allows the tool to find and stop the previous container without external state.

**Alternatives considered**:
- Lookup container by port — rejected: more complex, requires `docker ps` output parsing.
- User-specified container name — rejected for MVP; not in the spec.

---

## Decision 7: SSH Multi-Command Approach

**Decision**: Keep the existing pattern in `CSPAccess` — each Ship step in the pipeline is a separate SSH invocation.

**Rationale**: The existing `deployToEC2` iterates Ship steps and runs each via a new SSH connection. Changing to a single multiplexed session would require SSH connection reuse (ControlMaster), adding complexity without spec benefit. The three Ship steps (load, stop, run) are fast enough that separate connections are acceptable.

**Alternatives considered**:
- Combine all Ship commands into a single SSH session with `;` — rejected: makes error attribution harder; breaks the per-step result model.
- SSH ControlMaster multiplexing — out of scope for this feature.

---

## Decision 8: Cleanup of Local Artifact After Transfer

**Decision**: The local `image.tar.gz` lives in the `artifactDir` temp directory created by `ShippingEngine` using `mkdtempSync`. It is not explicitly deleted — OS temp directory cleanup handles it.

**Rationale**: FR-008 requires cleanup after successful or failed transfer. The `artifactDir` is already a temp dir (prefix `carburetor-artifacts-`). OS-level cleanup of `/tmp` is the standard and reliable mechanism. Explicit `unlink` would require try/finally plumbing through multiple layers — disproportionate for this feature scope.

**Alternatives considered**:
- Explicit `unlink` in `ShippingEngine.run` with try/finally — deferred: acceptable enhancement in a follow-up.

---

## All NEEDS CLARIFICATION Markers: Resolved

No clarification markers were present in the spec. All design decisions above were derived from the spec, codebase analysis, and the project's volatility-based architecture principles.
