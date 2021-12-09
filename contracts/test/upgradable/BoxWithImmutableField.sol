// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * Contract matching the data layout of the Box, but with an immutable field.
 */
contract BoxWithImmutableField is OwnableUpgradeable, UUPSUpgradeable {
    string private _value;
    uint256 private immutable _neverGoingToChange;

    event Store(string value);

    constructor() {
        _neverGoingToChange = 11;
    }

    function initialize() external virtual initializer {
        __Ownable_init();
    }

    function neverGoingToChange() external view returns (uint256) {
        return _neverGoingToChange;
    }

    function store(string calldata boxValue) external onlyOwner {
        _value = boxValue;

        emit Store(_value);
    }

    function value() external view returns (string memory) {
        return _value;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
