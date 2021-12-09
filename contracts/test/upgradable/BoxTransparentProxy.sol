// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * Contract matching the data layout of the Box, needing a Transparent proxy instead of UUPS.
 */
contract BoxTransparentProxy is OwnableUpgradeable {
    string private _value;

    event Store(string value);

    constructor() {
        _value = "8";
    }

    function initialize() external virtual initializer {
        __Ownable_init();
    }

    function store(string calldata boxValue) external onlyOwner {
        _value = boxValue;

        emit Store(_value);
    }

    function value() external view returns (string memory) {
        return _value;
    }
}
