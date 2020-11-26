[![License](https://img.shields.io/badge/License-Apache%202.0-yellowgreen.svg)](https://opensource.org/licenses/Apache-2.0)
[![Gitpod ready-to-code](https://img.shields.io/badge/Gitpod-ready--to--code-blue?logo=gitpod)](https://gitpod.io/#https://github.com/projen/projen)
![Build](https://github.com/projen/projen/workflows/Build/badge.svg)
![Release](https://github.com/projen/projen/workflows/Release/badge.svg)

# projen

Define and maintain complex project configuration through code.

> JOIN THE [#TemplatesAreEvil] MOVEMENT!

[#TemplatesAreEvil]: https://twitter.com/search?q=%23TemplatesAreEvil

*projen* synthesizes project configuration files such as `package.json`,
`tsconfig.json`, `.gitignore`, GitHub Workflows, eslint, jest, etc from a
well-typed definition written in JavaScript.

Check out [this talk](https://youtu.be/SOWMPzXtTCw) about projen.

As opposed to existing templating/scaffolding tools, *projen* is not a one-off
generator. Synthesized files should never be manually edited (in fact, projen
enforces that). To modify your project setup, users interact with rich
strongly-typed class and execute `projen` to update their project configuration
files.

## Getting Started

To create a new project, run the following command and follow the instructions:

```console
$ mkdir my-project
$ cd my-project
$ git init
$ npx projen new PROJECT-TYPE
🤖 Synthesizing project...
...
```

Currently supported project types (use `npx projen new` without a type for a
list):

<!-- <macro exec="node ./scripts/readme-projects.js"> -->
* [awscdk-app-ts](https://github.com/projen/projen/blob/master/API.md#projen-awscdktypescriptapp) - AWS CDK app in TypeScript.
* [awscdk-construct](https://github.com/projen/projen/blob/master/API.md#projen-awscdkconstructlibrary) - AWS CDK construct library project.
* [cdk8s-construct](https://github.com/projen/projen/blob/master/API.md#projen-constructlibrarycdk8s) - CDK8s construct library project.
* [jsii](https://github.com/projen/projen/blob/master/API.md#projen-jsiiproject) - Multi-language jsii library project.
* [nextjs](https://github.com/projen/projen/blob/master/API.md#projen-web.nextjsproject) - Next.js project without TypeScript.
* [nextjs-ts](https://github.com/projen/projen/blob/master/API.md#projen-web.nextjstypescriptproject) - Next.js project with TypeScript.
* [node](https://github.com/projen/projen/blob/master/API.md#projen-nodeproject) - Node.js project.
* [project](https://github.com/projen/projen/blob/master/API.md#projen-project) - Base project.
* [react](https://github.com/projen/projen/blob/master/API.md#projen-web.reactproject) - React project without TypeScript.
* [react-ts](https://github.com/projen/projen/blob/master/API.md#projen-web.reacttypescriptproject) - React project with TypeScript.
* [typescript](https://github.com/projen/projen/blob/master/API.md#projen-typescriptproject) - TypeScript project.
* [typescript-app](https://github.com/projen/projen/blob/master/API.md#projen-typescriptappproject) - TypeScript app.
<!-- </macro> -->

> Use `npx projen new PROJECT-TYPE --help` to view a list of command line
> switches that allows you to specify most project options during bootstrapping.
> For example: `npx projen new jsii --author-name "Jerry Berry"`.

The `new` command will create a `.projenrc.js` file which looks like this for
`jsii` projects:

```js
const { JsiiProject } = require('projen');

const project = new JsiiProject({
  authorAddress: "elad.benisrael@gmail.com",
  authorName: "Elad Ben-Israel",
  name: "foobar",
  repository: "https://github.com/eladn/foobar.git",
});

project.synth();
```

This program instantiates the project type with minimal setup, and then calls
`synth()` to synthesize the project files. By default, the `new` command will
also execute this program, which will result in a fully working project.

Once your project is created, you can configure your project by editing
`.projenrc.js` and re-running `npx projen` to synthesize again.

> The files generated by _projen_ are considered an "implementation detail" and
> _projen_ protects them from being manually edited (most files are marked
> read-only, and an "anti tamper" check is configured in the CI build workflow
> to ensure that files are not updated during build).

For example, to setup PyPI publishing in `jsii` projects, you can use
[`python option`](https://github.com/eladb/projen/blob/master/API.md#projen-jsiipythontarget):

```js
const project = new JsiiProject({
  // ...
  python: {
    distName: "mydist",
    module: "my_module",
  }
});
```

Run:

```shell
npx projen
```

And you'll notice that your `package.json` file now contains a `python` section in
it's `jsii` config and the GitHub `release.yml` workflow includes a PyPI
publishing step.

We recommend to put this in your shell profile, so you can simply run `pj` every
time you update `.projenrc.js`:

```bash
alias pj='npx projen'
```

Most projects support a `start` command which displays a menu of workflow
activities:

```shell
$ yarn start
? Scripts: (Use arrow keys)

  BUILD
❯ compile          Only compile
  watch            Watch & compile in the background
  build            Full release build (test+compile)

  TEST
  test             Run tests
  test:watch       Run jest in watch mode
  eslint           Runs eslint against the codebase

  ...
```

The `build` command is the same command that's executed in your CI builds. It
typically compiles, lints, tests and packages your module for distribution.

## Features

Some examples for features built-in to project types:

* Fully synthesize `package.json`
* Standard npm scripts like `compile`, `build`, `test`, `package`
* eslint
* Jest
* jsii: compile, package, api compatibility checks, API.md
* Bump & release scripts with CHANGELOG generation based on Conventional Commits
* Automated PR builds
* Automated releases to npm, maven, NuGet and PyPI
* Mergify configuration
* LICENSE file generation
* gitignore + npmignore management
* Node "engines" support with coupling to CI build environment and @types/node
* Anti-tamper: CI builds will fail if a synthesized file is modified manually

## API Reference

See [API Reference](./API.md) for API details.

## Ecosystem

_projen_ takes a "batteries included" approach and aims to offer dozens of different project types out of
the box (we are just getting started). Think `projen new react`, `projen new angular`, `projen new java-maven`,
`projen new awscdk-typescript`, `projen new cdk8s-python` (nothing in projen is tied to javascript or npm!)...

Adding new project types is as simple as submitting a pull request to this repo and exporting a class that
extends `projen.Project` (or one of it's derivatives). Projen automatically discovers project types so your
type will immediately be available in `projen new`.

### Projects in external modules

_projen_ is bundled with many project types out of the box, but it can also work
with project types and components defined in external jsii modules (the reason
we need jsii is because projen uses the jsii metadata to discover project types
& options in projen new).

Say we have a module in npm called `projen-vuejs` which includes a single project
type for vue.js:

```bash
$ npx projen new --from projen-vuejs
```

If the referenced module includes multiple project types, the type is required.
Switches can also be used to specify initial values based on the project type
APIs. You can also use any package syntax supported by [yarn
add](https://classic.yarnpkg.com/en/docs/cli/add#toc-adding-dependencies) like
`projen-vuejs@1.2.3`, `file:/path/to/local/folder`,
`git@github.com/awesome/projen-vuejs#1.2.3`, etc.

```bash
$ npx projen new --from projen-vuejs@^2 vuejs-ts --description "my awesome vue project"
```

Under the hood, `projen new` will install the `projen-vuejs` module from npm
(version 2.0.0 and above), discover the project types in it and bootstrap the
`vuejs-ts` project type. It will assign the value `"my awesome vue project"` to
the `description` field. If you examine your `.projenrc.js` file, you'll see
that `projen-vuejs` is defined as a dev dependency:

```javascript
const { VueJsProject } = require('projen-vuejs');

const project = new VueJsProject({
  name: 'my-vuejs-sample',
  description: "my awesome vue project",
  // ...
  devDeps: [
    'projen-vuejs'
  ]
});

project.synth();
```

## Contributing

Contributions of all kinds are welcome! See our [code of conduct](./CODE_OF_CONDUCT.md).

To check out a development environment:

```bash
$ git clone git@github.com:projen/projen
$ cd projen
$ yarn
```

## Roadmap

> A non-exhaustive list of ideas/directions for projen

- [ ] Multi-language support: ideally projenrc should be in the same language as your application code.
- [ ] External components & projects: `projen new` should be able to list project types from registered 3rd party modules so we can grow the ecosystem easily.
- [ ] Components: re-think/re-factor how components and projects interact to allow more modular and composabble usage.
- [ ] Discoverability of external components/modules through the CLI
- [ ] Support projenrc in YAML (fully declarative, if one desires)
- [ ] `projen SCRIPT`: make the CLI extensible so it can become _the_ project entrypoint (instead of e.g. `yarn`/`npm`, etc).
- [ ] CLI bash completion


## License

Distributed under the [Apache-2.0](./LICENSE) license.
