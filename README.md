# Solidity Project Template

Providing a project with a template for the files, folder structure, dependencies, scripting, configuration (local & remote) and development standards used in a WindRanger Soldity project with TypeScript tests.

---

## Development Process

### Git

Suite of ideas about git (summarised consensus of `#git`) by Set Robertson.
https://sethrobertson.github.io/GitBestPractices/

#### Commit early, commit often

Git works best, and works in your favor, when you commit your work often.
Instead of waiting to make the commit perfect, working in small chunks and continually committing your work, can aid with strealining development and rapid iterations and visibility / transparency.
Commit early and commit often combines will with the use of pull requests and squashed merges, as they create only single log entry.

#### Branch per a feature

Trunk based approach with a single main branch and ephemeral side branches.
https://trunkbaseddevelopment.com/

Create yourself a user fork off the main.
For every change set create a branch off your fork.
When the change set is complete, create a pull request to merge the changeset to main.
After the change set is merged, updated your fork from the upstream (main)

Branch protection can be used to enforce this behaviour for public repo's or private repo's when owned by Pro, Team and Enterprise organisations.

#### Git messages

Messages for commit and merge operations enter into the browsable log of project changes, providing a historical context for the project's development.

Consistency helps readers tremendously, please follow Conventional Commits
https://www.conventionalcommits.org/en/v1.0.0/

### TypeScript Style Guide

Follow the Google TypeScript style guide, as they're sensible.
https://google.github.io/styleguide/tsguide.html

### Solidity Style Guide

Follow the Soldity docs guide.
https://docs.soliditylang.org/en/v0.8.7/style-guide.html

---

## Project Installation, building and running

Git clone, then from the project root execute

#### Install

To retrieve the project dependencies and before any further tasks will run correctly

```shell
npm install
```

#### Husky Git Commit Hooks

To enable Husky commit hooks to trigger the lint-staged behaviour of formatting and linting the staged files prior
before committing, prepare your repo with `prepare`.

```shell
npm run prepare
```

#### Build and Test

```shell
npm run build
npm test
```

If you make changes that don't get picked up then add a clean into the process

```shell
npm run clean
npm run build
npm test
```

### Hardhat

If you want to avoid using the convience scripts, then you can execute against Hardhat directly.

#### All tests

Target to run all the mocha tests found in the `/test` directory, transpiled as necessary.

```shell
npx hardhat test
```

#### Single test

Run a single test (or a regex of tests), then pass in as an argument.

```shell
 npx hardhat test .\test\sample.test.ts
```

#### Scripts

The TypeScript transpiler will automatically as needed, execute through HardHat for the instantiated environment

```shell
npx hardhat run .\scripts\sample-script.ts
```

### Logging

Logging is performed with Bunyan

#### Bunyan CLI

To have the JSON logging output into a more human-readable form, pipe the stdout to the Bunyan CLI tool.

```shell
npx hardhat accounts | npx bunyan
```
