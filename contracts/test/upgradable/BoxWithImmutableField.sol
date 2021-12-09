// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Box.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * Contract matching the data layout of the Box, but with an immutable field.
 */
contract BoxWithImmutableField is OwnableUpgradeable, UUPSUpgradeable {
    uint256 private _value;
    uint256 private immutable _neverGoingToChange = 11;

    event Store(uint256 value);

    function initialize() external virtual initializer {
        __Ownable_init();
        _value = _neverGoingToChange;
    }

    function store(uint256 boxValue) external onlyOwner {
        _value = boxValue;

        emit Store(_value);
    }

    function value() external view returns (uint256) {
        return _value;
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
