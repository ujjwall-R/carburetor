import { ConfigLoader } from './config/ConfigLoader.js';
import { OrchestratingEngine } from './engines/OrchestratingEngine.js';
import { LocalPipelineExecutor } from './engines/executors/LocalPipelineExecutor.js';
import { VCSAccess } from './access/VCSAccess.js';
import { CSPAccess } from './access/CSPAccess.js';
import { ShippingEngine } from './engines/ShippingEngine.js';
import { DeploymentManager } from './managers/DeploymentManager.js';
import { DeployCLI } from './client/DeployCLI.js';

// --- Dependency injection wiring ---
const configLoader = new ConfigLoader();
const orchestrating = new OrchestratingEngine();
const executor = new LocalPipelineExecutor();
const vcsAccess = new VCSAccess();
const cspAccess = new CSPAccess();
const shipping = new ShippingEngine(vcsAccess, cspAccess, executor);
const manager = new DeploymentManager(
  orchestrating,
  shipping,
  (msg) => process.stdout.write(`  → ${msg}\n`)
);
const cli = new DeployCLI(manager, shipping, configLoader);

// --- Entry point ---
cli.run(process.argv).catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(3);
});
