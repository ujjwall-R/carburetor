import { describe, it, expect, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { ProjectType, VCSProvider, CloudPlatform } from '../../../../src/models/enums.js';

// ── Clack mock helpers ────────────────────────────────────────────────────────
// @clack/prompts is mocked at module level so WizardSession sees the fake.

const CANCEL_SYMBOL = Symbol('clack.cancel');

const mockClack = {
  intro: mock(() => {}),
  outro: mock(() => {}),
  note: mock(() => {}),
  cancel: mock(() => {}),
  select: mock(async () => ''),
  text: mock(async () => ''),
  password: mock(async () => ''),
  confirm: mock(async () => true),
  isCancel: (v: unknown) => v === CANCEL_SYMBOL,
};

// Replace the @clack/prompts module before importing WizardSession
mock.module('@clack/prompts', () => ({
  ...mockClack,
  default: mockClack,
  isCancel: mockClack.isCancel,
}));

// Lazy-import after mock is registered
const { WizardSession } = await import('../../../../src/client/wizard/WizardSession.js');

// ── Shared test data ──────────────────────────────────────────────────────────

const HAPPY_INPUTS = [
  ProjectType.ReactApp,     // Step 1 — project type
  'https://github.com/org/repo', // Step 2 — repo URL
  'main',                   // Step 3 — branch
  VCSProvider.GitHub,       // Step 4 — VCS provider
  'ghp_token123',           // Step 5 — VCS token
  CloudPlatform.AWS,        // Step 6 — platform
  'ec2',                    // Step 7 — service type
  'us-east-1',              // Step 8 — region
  'production',             // Step 9 — environment
  'i-0abc123def456',        // Step 10 — instance ID
  'AKIAIOSFODNN7EXAMPLE',   // Step 11 — AWS access key ID
  'wJalrXUtnFEMI/K7MDENG',  // Step 12 — AWS secret key
  'inline',                 // Step 13 — SSH key mode
  '-----BEGIN RSA PRIVATE KEY-----', // Step 14a — SSH key inline
  'ec2-user',               // Step 15 — SSH user
  '/var/www/app',           // Step 16 — deploy dir
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WizardSession', () => {
  let selectCallIdx: number;
  let textCallIdx: number;
  let passwordCallIdx: number;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    selectCallIdx = 0;
    textCallIdx = 0;
    passwordCallIdx = 0;

    // Reset all mocks
    mockClack.intro.mockClear();
    mockClack.outro.mockClear();
    mockClack.note.mockClear();
    mockClack.cancel.mockClear();
    mockClack.select.mockClear();
    mockClack.text.mockClear();
    mockClack.password.mockClear();
    mockClack.confirm.mockClear();

    // Wire up sequential return values for each prompt type
    const selectValues = [
      HAPPY_INPUTS[0],  // project type
      HAPPY_INPUTS[3],  // VCS provider
      HAPPY_INPUTS[5],  // platform
      HAPPY_INPUTS[6],  // service type
      HAPPY_INPUTS[12], // SSH key mode
    ];
    const textValues = [
      HAPPY_INPUTS[1],  // repo URL
      HAPPY_INPUTS[2],  // branch
      HAPPY_INPUTS[7],  // region
      HAPPY_INPUTS[8],  // environment
      HAPPY_INPUTS[9],  // instance ID
      HAPPY_INPUTS[14], // SSH user
      HAPPY_INPUTS[15], // deploy dir
    ];
    const passwordValues = [
      HAPPY_INPUTS[4],  // VCS token
      HAPPY_INPUTS[10], // AWS access key ID
      HAPPY_INPUTS[11], // AWS secret key
      HAPPY_INPUTS[13], // SSH key inline
    ];

    mockClack.select.mockImplementation(async () => selectValues[selectCallIdx++] ?? '');
    mockClack.text.mockImplementation(async () => textValues[textCallIdx++] ?? '');
    mockClack.password.mockImplementation(async () => passwordValues[passwordCallIdx++] ?? '');
    mockClack.confirm.mockImplementation(async () => true);

    // Spy on process.exit to prevent actual exit
    exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('assembles a DeploymentRequest with correct project type on happy path', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.project.type).toBe(ProjectType.ReactApp);
  });

  it('assembles a DeploymentRequest with correct VCS provider on happy path', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.vcsConfig.provider).toBe(VCSProvider.GitHub);
  });

  it('assembles a DeploymentRequest with correct cloud platform on happy path', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.target.platform).toBe(CloudPlatform.AWS);
  });

  it('sets vcsCredentials.token from the GitHub token prompt', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.vcsCredentials.token).toBe('ghp_token123');
  });

  it('sets cspCredentials.accessKeyId from the AWS key prompt', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.cspCredentials['accessKeyId']).toBe('AKIAIOSFODNN7EXAMPLE');
  });

  it('passes dryRun flag through to the returned request', async () => {
    const session = new WizardSession();
    const request = await session.run(true, false);
    expect(request.dryRun).toBe(true);
  });

  // ── SSH key inline path ───────────────────────────────────────────────────

  it('sets cspCredentials.sshKey when SSH mode is inline', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.cspCredentials['sshKey']).toBe('-----BEGIN RSA PRIVATE KEY-----');
    expect(request.cspCredentials['sshKeyPath']).toBeUndefined();
  });

  // ── SSH key path variant ─────────────────────────────────────────────────

  it('sets cspCredentials.sshKeyPath when SSH mode is path', async () => {
    selectCallIdx = 0;
    textCallIdx = 0;
    passwordCallIdx = 0;

    const selectValuesPath = [
      ProjectType.ReactApp,
      VCSProvider.GitHub,
      CloudPlatform.AWS,
      'ec2',
      'path', // SSH mode = path
    ];
    const textValuesPath = [
      'https://github.com/org/repo',
      'main',
      'us-east-1',
      'production',
      'i-0abc123def456',
      '~/.ssh/id_rsa',  // SSH key path
      'ec2-user',
      '/var/www/app',
    ];

    mockClack.select.mockImplementation(async () => selectValuesPath[selectCallIdx++] ?? '');
    mockClack.text.mockImplementation(async () => textValuesPath[textCallIdx++] ?? '');

    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.cspCredentials['sshKeyPath']).toBe('~/.ssh/id_rsa');
    expect(request.cspCredentials['sshKey']).toBeUndefined();
  });

  // ── Cancel path ───────────────────────────────────────────────────────────

  it('calls process.exit(1) and clack.cancel when first select returns cancel symbol', async () => {
    mockClack.select.mockImplementation(async () => CANCEL_SYMBOL);

    const session = new WizardSession();
    // run() will call process.exit(1) which is mocked — it won't throw
    await session.run(false, false).catch(() => {});

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockClack.cancel).toHaveBeenCalled();
  });
});
