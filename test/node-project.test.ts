import * as yaml from 'yaml';
import { DependencyType } from '../src/dependencies';
import { JobPermission } from '../src/github/workflows-model';
import { NodeProject, NodeProjectOptions, NodePackage, NodePackageManager, NpmAccess } from '../src/javascript';
import * as logging from '../src/logging';
import { Project } from '../src/project';
import { Tasks } from '../src/tasks';
import { synthSnapshot, TestProject } from './util';

logging.disable();

test('license file is added by default', () => {
  // WHEN
  const project = new TestNodeProject();

  // THEN
  expect(synthSnapshot(project).LICENSE).toContain('Apache License');
});

test('license file is not added if licensed is false', () => {
  // WHEN
  const project = new TestNodeProject({
    licensed: false,
  });

  // THEN
  const snapshot = synthSnapshot(project);
  expect(snapshot.LICENSE).toBeUndefined();
  expect(snapshot['.gitignore']).not.toContain('LICENSE');
  expect(snapshot['package.json'].license).toEqual('UNLICENSED');
});

describe('deps', () => {

  test('runtime deps', () => {
    // GIVEN
    const project = new TestNodeProject({
      deps: [
        'aaa@^1.2.3',
        'bbb@~4.5.6',
      ],
    });

    // WHEN
    project.addDeps('ccc');
    project.deps.addDependency('ddd', DependencyType.RUNTIME);

    // THEN
    const pkgjson = packageJson(project);
    expect(pkgjson.dependencies).toStrictEqual({
      aaa: '^1.2.3',
      bbb: '~4.5.6',
      ccc: '*',
      ddd: '*',
    });
    expect(pkgjson.peerDependencies).toStrictEqual({});
  });

  test('dev dependencies', () => {
    // GIVEN
    const project = new TestNodeProject({
      devDeps: [
        'aaa@^1.2.3',
        'bbb@~4.5.6',
      ],
    });

    // WHEN
    project.addDevDeps('ccc');
    project.deps.addDependency('ddd', DependencyType.TEST);
    project.deps.addDependency('eee@^1', DependencyType.DEVENV);
    project.deps.addDependency('fff@^2', DependencyType.BUILD);

    // THEN
    const pkgjson = packageJson(project);
    expect(pkgjson.devDependencies.aaa).toStrictEqual('^1.2.3');
    expect(pkgjson.devDependencies.bbb).toStrictEqual('~4.5.6');
    expect(pkgjson.devDependencies.ccc).toStrictEqual('*');
    expect(pkgjson.devDependencies.ddd).toStrictEqual('*');
    expect(pkgjson.devDependencies.eee).toStrictEqual('^1');
    expect(pkgjson.devDependencies.fff).toStrictEqual('^2');
    expect(pkgjson.peerDependencies).toStrictEqual({});
    expect(pkgjson.dependencieds).toBeUndefined();
  });

  test('peerDependencies', () => {
    // GIVEN
    const project = new TestNodeProject({
      peerDeps: [
        'aaa@^1.2.3',
        'bbb@~4.5.6',
      ],
    });

    // WHEN
    project.addPeerDeps('ccc');
    project.deps.addDependency('ddd', DependencyType.PEER);

    // THEN
    const pkgjson = packageJson(project);
    expect(pkgjson.peerDependencies).toStrictEqual({
      aaa: '^1.2.3',
      bbb: '~4.5.6',
      ccc: '*',
      ddd: '*',
    });

    // devDependencies are added with pinned versions
    expect(pkgjson.devDependencies.aaa).toStrictEqual('1.2.3');
    expect(pkgjson.devDependencies.bbb).toStrictEqual('4.5.6');
    expect(pkgjson.devDependencies.ccc).toStrictEqual('*');
    expect(pkgjson.devDependencies.ddd).toStrictEqual('*');
    expect(pkgjson.dependencieds).toBeUndefined();
  });

  test('peerDependencies without pinnedDevDep', () => {
    // GIVEN
    const project = new TestNodeProject({
      peerDependencyOptions: {
        pinnedDevDependency: false,
      },
      peerDeps: [
        'aaa@^1.2.3',
        'bbb@~4.5.6',
      ],
    });

    // WHEN
    project.addPeerDeps('ccc');
    project.deps.addDependency('ddd', DependencyType.PEER);

    // THEN
    const pkgjson = packageJson(project);
    expect(pkgjson.peerDependencies).toStrictEqual({
      aaa: '^1.2.3',
      bbb: '~4.5.6',
      ccc: '*',
      ddd: '*',
    });

    // sanitize
    ['npm-check-updates', 'jest', 'jest-junit', 'projen', 'standard-version'].forEach(d => delete pkgjson.devDependencies[d]);

    expect(pkgjson.devDependencies).toStrictEqual({});
    expect(pkgjson.dependencieds).toBeUndefined();
  });

  test('devDeps are only added for peerDeps if a runtime dep does not already exist', () => {
    // GIVEN
    const project = new TestNodeProject();

    // WHEN
    project.addPeerDeps('ccc@^2');
    project.addDeps('ccc@^2.3.3');

    // THEN
    const pkgjson = packageJson(project);

    // sanitize
    ['npm-check-updates', 'jest', 'jest-junit', 'projen', 'standard-version'].forEach(d => delete pkgjson.devDependencies[d]);

    expect(pkgjson.peerDependencies).toStrictEqual({ ccc: '^2' });
    expect(pkgjson.dependencies).toStrictEqual({ ccc: '^2.3.3' });
    expect(pkgjson.devDependencies).toStrictEqual({});
  });

  test('bundled deps are automatically added as normal deps', () => {
    // GIVEN
    const project = new TestNodeProject({
      bundledDeps: ['hey@2.1.1'],
    });

    // WHEN
    project.addBundledDeps('foo@^1.2.3');
    project.deps.addDependency('bar@~1.0.0', DependencyType.BUNDLED);

    // THEN
    const pkgjson = packageJson(project);
    expect(pkgjson.dependencies).toStrictEqual({
      hey: '2.1.1',
      foo: '^1.2.3',
      bar: '~1.0.0',
    });
    expect(pkgjson.bundledDependencies).toStrictEqual([
      'bar',
      'foo',
      'hey',
    ]);
  });
});

test('throw when \'autoApproveProjenUpgrades\' is used with \'projenUpgradeAutoMerge\'', () => {
  expect(() => {
    new TestNodeProject({ autoApproveProjenUpgrades: true, projenUpgradeAutoMerge: true });
  }).toThrow("'projenUpgradeAutoMerge' cannot be configured together with 'autoApproveProjenUpgrades'");
});

describe('deps upgrade', () => {

  test('throws when trying to auto approve projen but auto approve is not defined', () => {
    const message = 'Autoamtic approval of projen upgrades requires configuring `autoApproveOptions`';
    expect(() => { new TestNodeProject({ autoApproveProjenUpgrades: true }); }).toThrow(message);
    expect(() => { new TestNodeProject({ projenUpgradeAutoMerge: true }); }).toThrow(message);
  });

  test('throws when trying to auto approve deps but auto approve is not defined', () => {
    expect(() => {
      new TestNodeProject({ autoApproveUpgrades: true });
    }).toThrow('Autoamtic approval of dependencies upgrades requires configuring `autoApproveOptions`');
  });

  test('workflow can be auto approved', () => {
    const project = new TestNodeProject({
      autoApproveOptions: {
        allowedUsernames: ['dummy'],
        secret: 'dummy',
      },
      autoApproveUpgrades: true,
    });

    const snapshot = yaml.parse(synthSnapshot(project)['.github/workflows/upgrade-main.yml']);
    expect(snapshot.jobs.pr.steps[4].with.labels).toStrictEqual(project.autoApprove?.label);
  });

  test('commit can be signed', () => {
    const project = new TestNodeProject({
      depsUpgradeOptions: {
        signoff: true,
      },
    });

    const snapshot = yaml.parse(synthSnapshot(project)['.github/workflows/upgrade-main.yml']);
    expect(snapshot.jobs.pr).toMatchSnapshot();
  });

  test('dependabot can be auto approved', () => {
    const project = new TestNodeProject({
      dependabot: true,
      autoApproveOptions: {
        allowedUsernames: ['dummy'],
        secret: 'dummy',
      },
      autoApproveUpgrades: true,
    });

    const snapshot = yaml.parse(synthSnapshot(project)['.github/dependabot.yml']);
    expect(snapshot.updates[0].labels).toStrictEqual(['auto-approve']);
  });

  test('default - with projen secret', () => {
    const project = new TestNodeProject({ projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN' });
    const snapshot = synthSnapshot(project);
    expect(snapshot['.github/workflows/upgrade-main.yml']).toBeDefined();
    expect(snapshot['.github/workflows/upgrade-projen-main.yml']).toBeUndefined();

    // make sure yarn upgrade all deps, including projen.
    const tasks = snapshot[Tasks.MANIFEST_FILE].tasks;
    expect(tasks.upgrade.steps[6].exec).toStrictEqual('yarn upgrade');
  });

  test('default - no projen secret', () => {
    const project = new TestNodeProject();
    const snapshot = synthSnapshot(project);
    expect(snapshot['.github/workflows/upgrade-main.yml']).toBeDefined();
    expect(snapshot['.github/workflows/upgrade-projen-main.yml']).toBeUndefined();
  });

  test('dependabot - with projen secret', () => {
    const project = new TestNodeProject({
      dependabot: true,
      projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',
    });
    const snapshot = synthSnapshot(project);
    expect(snapshot['.github/dependabot.yml']).toBeDefined();
    expect(snapshot['.github/workflows/upgrade-projen-main.yml']).toBeDefined();
  });

  test('dependabot - no projen secret', () => {
    const project = new TestNodeProject({
      dependabot: true,
    });
    const snapshot = synthSnapshot(project);
    expect(snapshot['.github/dependabot.yml']).toBeDefined();
    expect(snapshot['.github/workflows/upgrade-projen-main.yml']).toBeUndefined();
  });

  test('github actions - with projen secret', () => {
    const project = new TestNodeProject({
      projenUpgradeSecret: 'PROJEN_GITHUB_TOKEN',
    });
    const snapshot = synthSnapshot(project);
    expect(snapshot['.github/workflows/upgrade-main.yml']).toBeDefined();
    expect(snapshot['.github/workflows/upgrade-projen-main.yml']).toBeUndefined();
  });

  test('github actions - no projen secret', () => {
    const project = new TestNodeProject({});
    const snapshot = synthSnapshot(project);
    expect(snapshot['.github/workflows/upgrade-main.yml']).toBeDefined();

    // note that in this case only the task is created, not the workflow
    const upgradeProjen = snapshot['.projen/tasks.json'].tasks['upgrade-projen'];
    expect(upgradeProjen).toBeDefined();
    expect(snapshot['.github/workflows/upgrade-projen-main.yml']).toBeUndefined();
  });

  test('throws when dependabot is configued with depsUpgrade', () => {
    expect(() => {
      new TestNodeProject({ dependabot: true, depsUpgrade: true });
    }).toThrow("'dependabot' cannot be configured together with 'depsUpgrade'");
  });

  test('can specity nested config withtout loosing default values', () => {

    const project = new TestNodeProject({
      autoApproveUpgrades: true,
      autoApproveOptions: {
        label: 'auto-approve',
        secret: 'GITHUB_TOKEN',
      },
      depsUpgradeOptions: {
        workflowOptions: {
          secret: 'PROJEN_SECRET',
        },
      },
    });
    const snapshot = synthSnapshot(project);
    const upgrade = yaml.parse(snapshot['.github/workflows/upgrade-main.yml']);

    // we expect the default auto-approve label to be applied
    expect(upgrade.jobs.pr.steps[4].with.labels).toEqual('auto-approve');

  });

  test('git identity of the upgrade workflow is customizable', () => {
    const project = new TestNodeProject({
      workflowGitIdentity: {
        name: 'hey',
        email: 'there@foo.com',
      },
    });

    const snapshot = synthSnapshot(project);
    const upgrade = yaml.parse(snapshot['.github/workflows/upgrade-main.yml']);

    // we expect the default auto-approve label to be applied
    expect(upgrade.jobs.pr.steps[1]).toStrictEqual({
      name: 'Set git identity',
      run: 'git config user.name "hey"\ngit config user.email "there@foo.com"',
    });
  });

});

describe('npm publishing options', () => {
  test('defaults', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      packageName: 'my-package',
    });

    // THEN
    expect(npm.npmAccess).toStrictEqual(NpmAccess.PUBLIC);
    expect(npm.npmRegistry).toStrictEqual('registry.npmjs.org');
    expect(npm.npmRegistryUrl).toStrictEqual('https://registry.npmjs.org/');
    expect(npm.npmTokenSecret).toStrictEqual('NPM_TOKEN');

    // since these are all defaults, publishConfig is not defined.
    expect(synthSnapshot(project)['package.json'].publishConfig).toBeUndefined();
  });

  test('scoped packages default to RESTRICTED access', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      packageName: 'scoped@my-package',
    });

    // THEN
    expect(npm.npmAccess).toStrictEqual(NpmAccess.RESTRICTED);

    // since these are all defaults, publishConfig is not defined.
    expect(packageJson(project).publishConfig).toBeUndefined();
  });

  test('non-scoped package cannot be RESTRICTED', () => {
    // GIVEN
    const project = new TestProject();

    // THEN
    expect(() => new NodePackage(project, {
      packageName: 'my-package',
      npmAccess: NpmAccess.RESTRICTED,
    })).toThrow(/"npmAccess" cannot be RESTRICTED for non-scoped npm package/);
  });

  test('custom settings', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      packageName: 'scoped@my-package',
      npmRegistryUrl: 'https://foo.bar',
      npmAccess: NpmAccess.PUBLIC,
      npmTokenSecret: 'GITHUB_TOKEN',
    });

    // THEN
    expect(npm.npmRegistry).toStrictEqual('foo.bar');
    expect(npm.npmRegistryUrl).toStrictEqual('https://foo.bar/');
    expect(npm.npmAccess).toStrictEqual(NpmAccess.PUBLIC);
    expect(npm.npmTokenSecret).toStrictEqual('GITHUB_TOKEN');
    expect(packageJson(project).publishConfig).toStrictEqual({
      access: 'public',
      registry: 'https://foo.bar/',
    });
  });

  test('registry with path', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      npmRegistryUrl: 'https://foo.bar/path/',
    });

    // THEN
    expect(npm.npmRegistry).toStrictEqual('foo.bar/path/');
    expect(npm.npmRegistryUrl).toStrictEqual('https://foo.bar/path/');
    expect(packageJson(project).publishConfig).toStrictEqual({
      registry: 'https://foo.bar/path/',
    });
  });

  test('AWS CodeArtifact registry', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      npmRegistryUrl: 'https://my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/',
    });

    // THEN
    expect(npm.npmRegistry).toStrictEqual('my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/');
    expect(npm.npmRegistryUrl).toStrictEqual('https://my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/');
    expect(packageJson(project).publishConfig).toStrictEqual({
      registry: 'https://my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/',
    });
    expect(npm.codeArtifactOptions?.accessKeyIdSecret).toStrictEqual('AWS_ACCESS_KEY_ID');
    expect(npm.codeArtifactOptions?.secretAccessKeySecret).toStrictEqual('AWS_SECRET_ACCESS_KEY');
  });

  test('AWS CodeArtifact registry custom values', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      npmRegistryUrl: 'https://my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/',
      codeArtifactOptions: {
        accessKeyIdSecret: 'OTHER_AWS_ACCESS_KEY_ID',
        secretAccessKeySecret: 'OTHER_AWS_SECRET_ACCESS_KEY',
      },
    });

    // THEN
    expect(npm.codeArtifactOptions?.accessKeyIdSecret).toStrictEqual('OTHER_AWS_ACCESS_KEY_ID');
    expect(npm.codeArtifactOptions?.secretAccessKeySecret).toStrictEqual('OTHER_AWS_SECRET_ACCESS_KEY');
  });

  test('throw when \'npmTokenSecret\' is used with AWS CodeArtifact', () => {
    // GIVEN
    const project = new TestProject();

    // THEN
    expect(() => {
      new NodePackage(project, {
        npmRegistryUrl: 'https://my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/',
        npmTokenSecret: 'INVALID_VALUE',
      });
    }).toThrow('"npmTokenSecret" must not be specified when publishing AWS CodeArtifact.');
  });

  test('throw when \'codeArtifactOptions.accessKeyIdSecret\' or \'codeArtifactOptions.secretAccessKeySecret\' is used without AWS CodeArtifact', () => {
    // GIVEN
    const project = new TestProject();

    // THEN
    expect(() => {
      new NodePackage(project, {
        codeArtifactOptions: {
          accessKeyIdSecret: 'INVALID_AWS_ACCESS_KEY_ID',
        },
      });
    }).toThrow('codeArtifactOptions must only be specified when publishing AWS CodeArtifact.');
    expect(() => {
      new NodePackage(project, {
        codeArtifactOptions: {
          secretAccessKeySecret: 'INVALID_AWS_SECRET_ACCESS_KEY',
        },
      });
    }).toThrow('codeArtifactOptions must only be specified when publishing AWS CodeArtifact.');
  });

  test('AWS CodeArtifact registry role to assume', () => {
    // GIVEN
    const project = new TestProject();
    const roleArn = 'role-arn';

    // WHEN
    const npm = new NodePackage(project, {
      npmRegistryUrl: 'https://my-domain-111122223333.d.codeartifact.us-west-2.amazonaws.com/npm/my_repo/',
      codeArtifactOptions: {
        roleToAssume: roleArn,
      },
    });

    // THEN
    expect(npm.codeArtifactOptions?.roleToAssume).toStrictEqual(roleArn);
  });

  test('deprecated npmRegistry can be used instead of npmRegistryUrl and then https:// is assumed', () => {
    // GIVEN
    const project = new TestProject();

    // WHEN
    const npm = new NodePackage(project, {
      packageName: 'scoped@my-package',
      npmRegistry: 'foo.bar.com',
    });

    // THEN
    expect(npm.npmRegistry).toStrictEqual('foo.bar.com');
    expect(npm.npmRegistryUrl).toStrictEqual('https://foo.bar.com/');
    expect(packageJson(project).publishConfig).toStrictEqual({
      registry: 'https://foo.bar.com/',
    });
  });
});

test('extend github release workflow', () => {
  const project = new TestNodeProject();

  project.release?.addJobs({
    publish_docker_hub: {
      permissions: {
        contents: JobPermission.READ,
      },
      runsOn: ['ubuntu-latest'],
      env: {
        CI: 'true',
      },
      steps: [
        {
          name: 'Check out the repo',
          uses: 'actions/checkout@v2',
        },
        {
          name: 'Push to Docker Hub',
          uses: 'docker/build-push-action@v1',
          with: {
            username: '${{ secrets.DOCKER_USERNAME }}',
            password: '${{ secrets.DOCKER_PASSWORD }}',
            repository: 'projen/projen-docker',
            tag_with_ref: 'true',
          },
        },
      ],
    },
  });

  const workflow = synthSnapshot(project)['.github/workflows/release.yml'];
  expect(workflow).toContain('publish_docker_hub:\n    runs-on: ubuntu-latest\n');
  expect(workflow).toContain('username: ${{ secrets.DOCKER_USERNAME }}\n          password: ${{ secrets.DOCKER_PASSWORD }}');
});

describe('scripts', () => {
  test('addTask and setScript', () => {
    const p = new TestNodeProject();
    p.addTask('chortle', { exec: 'echo "frabjous day!"' });
    p.setScript('slithy-toves', 'gyre && gimble');
    const pkg = packageJson(p);
    expect(pkg.scripts).toHaveProperty('chortle');
    expect(pkg.scripts).toHaveProperty('slithy-toves');
  });

  test('removeScript will remove tasks and scripts', () => {
    const p = new TestNodeProject();

    p.addTask('chortle', { exec: 'echo "frabjous day!"' });
    p.setScript('slithy-toves', 'gyre && gimble');
    p.removeScript('chortle');
    p.removeScript('slithy-toves');
    const pkg = packageJson(p);
    expect(pkg.scripts).not.toHaveProperty('chortle');
    expect(pkg.scripts).not.toHaveProperty('slithy-toves');
  });
});

test('mutableBuild will push changes to PR branches', () => {
  // WHEN
  const project = new TestNodeProject({
    mutableBuild: true,
  });

  // THEN
  const workflowYaml = synthSnapshot(project)['.github/workflows/build.yml'];
  const workflow = yaml.parse(workflowYaml);
  expect(workflow.jobs.build.steps).toMatchSnapshot();
});

test('projen synth is only executed for subprojects', () => {
  // GIVEN
  const root = new TestNodeProject();

  // WHEN
  new TestNodeProject({ parent: root, outdir: 'child' });

  // THEN
  const snapshot = synthSnapshot(root);
  const rootBuildTask = snapshot['.projen/tasks.json'].tasks.build;
  const childBuildTask = snapshot['child/.projen/tasks.json'].tasks.build;
  expect(rootBuildTask).toStrictEqual({
    description: 'Full release build',
    name: 'build',
    steps: [
      { spawn: 'default' },
      { spawn: 'pre-compile' },
      { spawn: 'compile' },
      { spawn: 'post-compile' },
      { spawn: 'test' },
      { spawn: 'package' },
    ],
  });
  expect(childBuildTask).toStrictEqual({
    description: 'Full release build',
    name: 'build',
    steps: [
      { spawn: 'pre-compile' },
      { spawn: 'compile' },
      { spawn: 'post-compile' },
      { spawn: 'test' },
      { spawn: 'package' },
    ],
  });
});

test('enable anti-tamper', () => {
  // WHEN
  const project = new TestNodeProject({
    packageManager: NodePackageManager.NPM,
    releaseToNpm: true,
    mutableBuild: false,
    antitamper: true,
  });

  // THEN
  const workflowYaml = synthSnapshot(project)['.github/workflows/build.yml'];
  const workflow = yaml.parse(workflowYaml);
  expect(workflow.jobs.build.steps).toMatchSnapshot();
  expect(workflow.jobs.build.steps).toEqual(expect.arrayContaining([
    expect.objectContaining({
      name: 'Anti-tamper check',
    }),
  ]));
});

test('enabling dependabot does not overturn mergify: false', () => {
  // WHEN
  const project = new TestNodeProject({
    dependabot: true,
    mergify: false,
  });

  // THEN
  const snapshot = synthSnapshot(project);
  // Note: brackets important, they prevent "." in filenames to be interpreted
  //       as JSON object path delimiters.
  expect(snapshot).not.toHaveProperty(['.mergify.yml']);
  expect(snapshot).toHaveProperty(['.github/dependabot.yml']);
});

test('github: false disables github integration', () => {
  // WHEN
  const project = new TestNodeProject({
    github: false,
  });

  // THEN
  const output = synthSnapshot(project);
  expect(Object.keys(output).filter(p => p.startsWith('.github/'))).toStrictEqual([]);
});

test('githubOptions.workflows:false disables github workflows but not github integration', () => {
  // WHEN
  const project = new TestNodeProject({
    githubOptions: {
      workflows: false,
    },
  });

  // THEN
  const output = synthSnapshot(project);
  expect(Object.keys(output).filter(p => p.startsWith('.github/'))).toStrictEqual(['.github/pull_request_template.md']);
});

test('using GitHub npm registry will default npm secret to GITHUB_TOKEN', () => {
  // GIVEN
  const project = new TestNodeProject({
    npmRegistryUrl: 'https://npm.pkg.github.com',
  });

  // THEN
  const output = synthSnapshot(project);
  expect(output['.github/workflows/release.yml']).not.toMatch('NPM_TOKEN');
});

function packageJson(project: Project) {
  return synthSnapshot(project)['package.json'];
}

test('workflowGitIdentity can be used to customize the git identity used in build workflows', () => {
  // GIVEN
  const project = new TestNodeProject({
    workflowGitIdentity: {
      name: 'heya',
      email: 'there@z.com',
    },
  });

  // THEN
  const output = synthSnapshot(project);
  const buildWorkflow = yaml.parse(output['.github/workflows/build.yml']);
  expect(buildWorkflow.jobs.build.steps[1]).toStrictEqual({
    name: 'Set git identity',
    run: 'git config user.name "heya"\ngit config user.email "there@z.com"',
  });
});

class TestNodeProject extends NodeProject {
  constructor(options: Partial<NodeProjectOptions> = {}) {
    super({
      name: 'test-node-project',
      defaultReleaseBranch: 'main',
      ...options,
    });
  }
}
