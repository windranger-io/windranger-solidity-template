# HardHat

We use the [Hardhat](https://hardhat.org/) development environment, to compile, test and deploy our contracts.

## Direct running
If you want to avoid using the convenience targets in the `package.json`, then you can execute against Hardhat directly.

### All tests

Target to run all the mocha tests found in the `/test` directory, transpiled as necessary.

```shell
npx hardhat test
```

### Single test

Run a single test (or a regex of tests), then pass in as an argument.

```shell
 npx hardhat test .\test\sample.test.ts
```

### Scripts

The TypeScript transpiler will automatically as needed, execute through HardHat for the instantiated environment

```shell
npx hardhat run .\scripts\sample-script.ts
```

## Logging

Logging is performed with Bunyan

### Bunyan CLI

To have the JSON logging output into a more human-readable form, pipe the stdout to the Bunyan CLI tool.

```shell
npx hardhat accounts | npx bunyan
```
