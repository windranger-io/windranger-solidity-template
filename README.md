# Solidity Project Template

Providing a project with a template for the files, folder structure, dependencies, scripting, configuration (local & remote) and development standards used in a Windranger Soldity project with TypeScript tests.

---

## Development Process

Development follows these processes outlined in [development process](docs/development_process.md)

---

## Install, build and run

Start by cloning the git repo locally.

#### Install

To retrieve the project dependencies and before any further tasks will run correctly.

```shell
npm ci
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

## Tools

Setup and run instructions:

- [Hardhat](./docs/tools/hardhat.md)
- [PlantUML](./docs/tools/plantuml.md); UML diagram generation from code.
- [Slither](./docs/tools/slither.md); Trail of Bits Solidity static analyzer.
