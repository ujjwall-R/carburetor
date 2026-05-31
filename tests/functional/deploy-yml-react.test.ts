/**
 * Functional test: real deployment using root megalodon.yml + .env
 *
 * Runs the full stack end-to-end — no stubs, no mocks:
 *   ConfigLoader → OrchestratingEngine → ShippingEngine
 *   → LocalPipelineExecutor + VCSAccess + CSPAccess
 *
 * Bun loads the root .env automatically, so credentials are available
 * in process.env without any additional setup.
 *
 * Prerequisites:
 *   - .env at repo root with valid credentials
 *   - megalodon.yml at repo root pointing to a deployable React app + target
 */
import { describe, it, expect } from 'bun:test';
import { join } from 'path';

import { ConfigLoader } from '../../src/config/ConfigLoader.js';
import { DeploymentManager } from '../../src/managers/DeploymentManager.js';
import { OrchestratingEngine } from '../../src/engines/OrchestratingEngine.js';
import { ShippingEngine } from '../../src/engines/ShippingEngine.js';
import { LocalPipelineExecutor } from '../../src/engines/executors/LocalPipelineExecutor.js';
import { VCSAccess } from '../../src/access/VCSAccess.js';
import { CSPAccess } from '../../src/access/CSPAccess.js';
import { ExecutionStatus } from '../../src/models/enums.js';

const CONFIG_PATH = join(import.meta.dir, '..', '..', 'megalodon.yml');

describe('functional: deploy React app via megalodon.yml', () => {
  it('deploys the configured React app and returns a Completed outcome', async () => {
    const configLoader = new ConfigLoader();
    const config = configLoader.load(CONFIG_PATH);
    const vcsCredentials = configLoader.resolveVCSCredentials();
    const cspCredentials = configLoader.resolveCSPCredentials(config.target.platform);

    const manager = new DeploymentManager(
      new OrchestratingEngine(),
      new ShippingEngine(new VCSAccess(), new CSPAccess(), new LocalPipelineExecutor()),
    );

    const outcome = await manager.deploy({
      project: {
        ...(config.project.type ? { type: config.project.type } : {}),
        buildConfig: config.project.build,
      },
      target: config.target,
      vcsConfig: config.vcs,
      vcsCredentials,
      cspCredentials,
      dryRun: false,
      verbose: true,
    });

    expect(outcome.status).toBe(ExecutionStatus.Completed);
  }, 120_000);
});
