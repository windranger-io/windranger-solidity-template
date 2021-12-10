# Slither - Solidity static analyzer

We use the Trail of Bits Solidity static analyzer [Slither](https://github.com/crytic/slither).

## Usage

Either setup and run in your local environment or in a Docker container.

### Local Environment

#### Install

With Python 3 in your environment, install using the Python package manager `pip3`:

```shell
pip3 install slither-analyzer
```

#### Run

When at the project root, to run using the project configuration:

```shell
slither . --config-file slither.json
```

### Docker

The Trail of Bits toolbox image contains a number of applications (including Slither).

#### Install

With Docker in your environment, install the image from DockerHub:

```shell
docker pull trailofbits/eth-security-toolbox
```

#### Run

To start a new container with your local source mounted/accessible within the container:
(replacing <ABSOLUTE_PATH_TO_WORKING_DIRECTORY> with the absolute path to the project working directory)

```shell
docker run -it --mount type=bind,source=<ABSOLUTE_PATH_TO_WORKING_DIRECTORY>,destination=/home/ethsec/test-me trailofbits/eth-security-toolbox
```

The container will automatically start and log you in, with the project code located in `test-me`.
Navigate into the `test-me` directory and run the static analysis:

```shell
cd test-me
--config-file slither.json
```

## Excluded Detectors

### Solidity version too new

[incorrect-versions-of-solidity](https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-versions-of-solidity) ensures a version of Solidity is used, where the set of bugs and exploits are known. Practically this mean using a previous minor version of Solidity.

When the release cycle is likely to pass a new minor of Solidity, using the latest version in development is acceptable, as that becomes a valid version by the time the audit has passed.

### Functions must be camel case

[conformance-to-solidity-naming-conventions](https://github.com/crytic/slither/wiki/Detector-Documentation#conformance-to-solidity-naming-conventions) ensures functions conform to camel case.

The convention from Open Zeppelin upgradable contracts includes adding a CapWord for the contract.

e.g OwnableUpgradable

```solidity
    function __Ownable_init() internal initializer {
```

## Excluded Directories

Files and directories may be excluded when they're libraries, or are still under active development.

### Node Modules

From the perspective of the repo, everything under `node_modules` is considered as a library.
