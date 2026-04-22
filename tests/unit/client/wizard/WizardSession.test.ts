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

// fs.existsSync is used by the Docker Dockerfile path validation — mock it to return true
mock.module('fs', () => ({
  existsSync: () => true,
}));

// Lazy-import after mock is registered
const { WizardSession } = await import('../../../../src/client/wizard/WizardSession.js');

// ── Shared test data ──────────────────────────────────────────────────────────

const HAPPY_INPUTS = [
  ProjectType.ReactApp,          // Step 1  — project type
  'https://github.com/org/repo', // Step 2  — repo URL
  'main',                        // Step 3  — branch
  VCSProvider.GitHub,            // Step 4  — VCS provider
  'ghp_token123',                // Step 5  — VCS token
  CloudPlatform.AWS,             // Step 6  — platform
  'ec2',                         // Step 7  — service type
  'us-east-1',                   // Step 8  — region
  'production',                  // Step 9  — environment
  'i-0abc123def456',             // Step 10 — instance ID
  'AKIAIOSFODNN7EXAMPLE',        // Step 11 — AWS access key ID
  'wJalrXUtnFEMI/K7MDENG',       // Step 12 — AWS secret key
  'inline',                      // Step 13 — SSH key mode
  '-----BEGIN RSA PRIVATE KEY-----', // Step 14a — SSH key inline
  'ec2-user',                    // Step 15 — SSH user
  // deploy dir removed — now uses /var/www/html default
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
      HAPPY_INPUTS[14], // SSH user  (was index 14; deploy dir removed)
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

  // ── Happy path (React) ─────────────────────────────────────────────────────

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

  it('does not set deployDir on cspCredentials (uses default)', async () => {
    const session = new WizardSession();
    const request = await session.run(false, false);
    expect(request.cspCredentials['deployDir']).toBeUndefined();
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
      '~/.ssh/id_rsa',  // SSH key path (prompted before SSH user in path mode)
      'ec2-user',
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

  // ── Docker happy path ─────────────────────────────────────────────────────

  describe('Docker wizard path', () => {
    let dockerSelectIdx: number;
    let dockerTextIdx: number;
    let dockerPasswordIdx: number;
    let dockerConfirmIdx: number;

    const setupDockerMocks = (
      selectValues: unknown[],
      textValues: string[],
      passwordValues: string[],
      confirmValues: boolean[]
    ) => {
      dockerSelectIdx = 0;
      dockerTextIdx = 0;
      dockerPasswordIdx = 0;
      dockerConfirmIdx = 0;

      mockClack.select.mockClear();
      mockClack.text.mockClear();
      mockClack.password.mockClear();
      mockClack.confirm.mockClear();

      mockClack.select.mockImplementation(async () => selectValues[dockerSelectIdx++] ?? '');
      mockClack.text.mockImplementation(async () => textValues[dockerTextIdx++] ?? '');
      mockClack.password.mockImplementation(async () => passwordValues[dockerPasswordIdx++] ?? '');
      mockClack.confirm.mockImplementation(async () => confirmValues[dockerConfirmIdx++] ?? true);
    };

    beforeEach(() => {
      // Default: SSL disabled (false), proceed (true)
      setupDockerMocks(
        [ProjectType.Docker, CloudPlatform.AWS, 'ec2', 'path'],
        ['./Dockerfile', 'us-east-1', 'production', 'i-0abc123def456', '~/.ssh/id_rsa', 'ec2-user'],
        ['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG'],
        [false, true]  // SSL=no, confirm=yes
      );
    });

    it('sets project.type to Docker', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.project.type).toBe(ProjectType.Docker);
    });

    it('sets buildConfig.dockerfilePath from Dockerfile prompt', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.project.buildConfig.dockerfilePath).toBe('./Dockerfile');
    });

    it('sets target.platform and target.resourceId from EC2 prompts', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.target.platform).toBe(CloudPlatform.AWS);
      expect(request.target.resourceId).toBe('i-0abc123def456');
    });

    it('sets cspCredentials with AWS keys and SSH details', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.cspCredentials['accessKeyId']).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(request.cspCredentials['sshUser']).toBe('ec2-user');
      expect(request.cspCredentials['sshKeyPath']).toBe('~/.ssh/id_rsa');
    });

    it('stubs vcsCredentials with empty token', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.vcsCredentials.token).toBe('');
    });

    it('does not set deployDir on cspCredentials', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.cspCredentials['deployDir']).toBeUndefined();
    });

    // ── SSL disabled (default) ───────────────────────────────────────────

    it('does not set domain or sslEmail when SSL is disabled', async () => {
      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.project.buildConfig.domain).toBeUndefined();
      expect(request.project.buildConfig.sslEmail).toBeUndefined();
    });

    // ── SSL enabled ──────────────────────────────────────────────────────

    it('sets domain and sslEmail in buildConfig when SSL is enabled', async () => {
      setupDockerMocks(
        [ProjectType.Docker, CloudPlatform.AWS, 'ec2', 'path'],
        ['./Dockerfile', 'us-east-1', 'production', 'i-0abc123def456', '~/.ssh/id_rsa', 'ec2-user', 'example.com', 'admin@example.com'],
        ['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG'],
        [true, true]  // SSL=yes, confirm=yes
      );

      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.project.buildConfig.domain).toBe('example.com');
      expect(request.project.buildConfig.sslEmail).toBe('admin@example.com');
    });

    it('includes dockerfilePath alongside domain and sslEmail when SSL is enabled', async () => {
      setupDockerMocks(
        [ProjectType.Docker, CloudPlatform.AWS, 'ec2', 'path'],
        ['./Dockerfile', 'us-east-1', 'production', 'i-0abc123def456', '~/.ssh/id_rsa', 'ec2-user', 'myapp.io', 'ssl@myapp.io'],
        ['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG'],
        [true, true]
      );

      const session = new WizardSession();
      const request = await session.run(false, false);
      expect(request.project.buildConfig.dockerfilePath).toBe('./Dockerfile');
      expect(request.project.buildConfig.domain).toBe('myapp.io');
      expect(request.project.buildConfig.sslEmail).toBe('ssl@myapp.io');
    });

    it('exits when SSL confirm is cancelled', async () => {
      setupDockerMocks(
        [ProjectType.Docker, CloudPlatform.AWS, 'ec2', 'path'],
        ['./Dockerfile', 'us-east-1', 'production', 'i-0abc123def456', '~/.ssh/id_rsa', 'ec2-user'],
        ['AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG'],
        [false, false]  // SSL=no, but decline final confirmation
      );

      const session = new WizardSession();
      await session.run(false, false).catch(() => {});
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
