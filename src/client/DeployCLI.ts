import { Command } from 'commander';
import { version } from '../../package.json';
import { ExecutionStatus } from '../models/enums.js';
import type { IDeploymentManager } from '../managers/IDeploymentManager.js';
import type { DeploymentOutcome } from '../models/DeploymentOutcome.js';
import type { DeploymentRequest } from '../models/DeploymentRequest.js';
import type { CarboratorConfig, ConfigLoader } from '../config/ConfigLoader.js';

interface CLIArgs {
  config: string;
  interactive: boolean;
  target?: string;
  env?: string;
  dryRun: boolean;
  verbose: boolean;
  json: boolean;
}

export class DeployCLI {
  private program: Command;

  constructor(
    private readonly manager: IDeploymentManager,
    private readonly configLoader: ConfigLoader
  ) {
    this.program = this.buildProgram();
  }

  async run(argv: string[]): Promise<void> {
    await this.program.parseAsync(argv);
  }

  private buildProgram(): Command {
    const program = new Command('carburetor')
      .description('Deploy applications to cloud platforms')
      .version(version);

    program
      .command('deploy')
      .description('Deploy application to the configured cloud platform')
      .option('-c, --config <path>', 'Path to carburetor.yml', './carburetor.yml')
      .option('-i, --interactive', 'Launch interactive setup wizard', false)
      .option('-t, --target <platform>', 'Override target platform (aws|gcp|azure|lambda)')
      .option('-e, --env <name>', 'Override environment name')
      .option('--dry-run', 'Validate config and credentials without deploying', false)
      .option('--json', 'Emit newline-delimited JSON events', false)
      .option('-v, --verbose', 'Show full step output', false)
      .action(async (opts: CLIArgs) => {
        await this.runDeploy(opts);
      });

    program
      .command('validate')
      .description('Validate carburetor.yml and cloud credentials without deploying')
      .option('-c, --config <path>', 'Path to carburetor.yml', './carburetor.yml')
      .action(async (opts: { config: string }) => {
        await this.runValidate(opts.config);
      });

    program
      .command('version')
      .description('Print installed version')
      .action(() => {
        console.log(`carburetor v${version}`);
      });

    return program;
  }

  private async runDeploy(args: CLIArgs): Promise<void> {
    // Interactive path — skip config file when --interactive is set and --config was not explicitly provided
    if (args.interactive && args.config === './carburetor.yml') {
      const { WizardSession } = await import('./wizard/WizardSession.js');
      const session = new WizardSession();
      const request = await session.run(args.dryRun, args.verbose);
      await this.executeRequest(request, args);
      return;
    }

    if (args.interactive && args.config !== './carburetor.yml') {
      process.stderr.write('Warning: --interactive ignored when --config is provided. Using config file.\n');
    }

    // File-based path
    let config: CarboratorConfig;
    try {
      config = this.configLoader.load(args.config);
    } catch (err) {
      this.printError(`Failed to load config: ${(err as Error).message}`);
      process.exit(1);
    }

    if (args.target) {
      config.target.platform = args.target as import('../models/enums.js').CloudPlatform;
    }
    if (args.env) {
      config.target.environment = args.env;
    }

    let vcsCredentials: import('../models/DeploymentRequest.js').VCSCredentials;
    let cspCredentials: import('../models/DeploymentRequest.js').CSPCredentials;
    try {
      vcsCredentials = this.configLoader.resolveVCSCredentials();
      cspCredentials = this.configLoader.resolveCSPCredentials(config.target.platform);
    } catch (err) {
      this.printError((err as Error).message);
      process.exit(1);
    }

    const request: DeploymentRequest = {
      project: { ...(config.project.type ? { type: config.project.type } : {}), buildConfig: config.project.build },
      target: config.target,
      vcsConfig: config.vcs,
      vcsCredentials,
      cspCredentials,
      dryRun: args.dryRun,
      verbose: args.verbose,
    };

    await this.executeRequest(request, args);
  }

  private async executeRequest(request: DeploymentRequest, args: CLIArgs): Promise<void> {
    if (args.dryRun) {
      this.printLine('Dry run — validating config and credentials only.');
      const validation = await this.manager.validate(request);
      if (validation.valid) {
        this.printLine('✓ Config and credentials valid. No deployment performed.');
        process.exit(0);
      } else {
        this.printError(`Validation failed:\n  ${validation.errors.join('\n  ')}`);
        process.exit(1);
      }
    }

    const outcome = await this.manager.deploy(request);
    this.renderOutcome(outcome, args.json);
    process.exit(outcome.status === ExecutionStatus.Completed || outcome.status === ExecutionStatus.Pending ? 0 : 2);
  }

  private async runValidate(configPath: string): Promise<void> {
    let config: CarboratorConfig;
    try {
      config = this.configLoader.load(configPath);
    } catch (err) {
      this.printError(`Failed to load config: ${(err as Error).message}`);
      process.exit(1);
    }

    let vcsCredentials: import('../models/DeploymentRequest.js').VCSCredentials;
    let cspCredentials: import('../models/DeploymentRequest.js').CSPCredentials;
    try {
      vcsCredentials = this.configLoader.resolveVCSCredentials();
      cspCredentials = this.configLoader.resolveCSPCredentials(config.target.platform);
    } catch (err) {
      this.printError((err as Error).message);
      process.exit(1);
    }

    const request: DeploymentRequest = {
      project: { ...(config.project.type ? { type: config.project.type } : {}), buildConfig: config.project.build },
      target: config.target,
      vcsConfig: config.vcs,
      vcsCredentials,
      cspCredentials,
      dryRun: true,
      verbose: false,
    };

    console.log('Validating credentials...');
    const validation = await this.manager.validate(request);

    if (validation.valid) {
      console.log('✓ VCS credentials valid');
      console.log('✓ Cloud credentials valid');
      console.log('\n✓ All checks passed — ready to deploy.');
      process.exit(0);
    } else {
      validation.errors.forEach((e) => console.error(`  ✗ ${e}`));
      console.error('\n✗ Validation failed.');
      process.exit(1);
    }
  }

  private renderOutcome(outcome: DeploymentOutcome, jsonMode: boolean): void {
    if (jsonMode) {
      console.log(JSON.stringify({
        type: 'outcome',
        status: outcome.status,
        endpoint: outcome.endpoint,
        trackingUrl: outcome.trackingUrl,
        error: outcome.error,
        totalDurationMs: outcome.totalDurationMs,
      }));
      return;
    }

    switch (outcome.status) {
      case ExecutionStatus.Completed:
        console.log('\n✓ Deployed successfully');
        if (outcome.endpoint) console.log(`  Endpoint: ${outcome.endpoint}`);
        console.log(`  Total time: ${(outcome.totalDurationMs / 1000).toFixed(1)}s`);
        break;

      case ExecutionStatus.Pending:
        console.log('\n⧗ Build submitted to remote executor');
        if (outcome.trackingUrl) console.log(`  Track at: ${outcome.trackingUrl}`);
        break;

      case ExecutionStatus.Failed:
        console.error(`\n✗ Deployment failed`);
        if (outcome.failedStep) {
          console.error(`  Failed step: ${outcome.failedStep.stepName}`);
          if (outcome.failedStep.error) console.error(`  Reason: ${outcome.failedStep.error}`);
          if (outcome.failedStep.output?.trim()) {
            console.error(`  Output:\n${outcome.failedStep.output.trim().split('\n').map(l => `    ${l}`).join('\n')}`);
          }
        }
        if (outcome.error) console.error(`  ${outcome.error}`);
        break;
    }
  }

  private printLine(msg: string): void {
    console.log(msg);
  }

  private printError(msg: string): void {
    console.error(`Error: ${msg}`);
  }
}
