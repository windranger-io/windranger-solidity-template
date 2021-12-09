// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * Contract matching the data layout of the Box, but with a field initialised on construction.
 */
contract BoxWithInitialValueField is OwnableUpgradeable, UUPSUpgradeable {
    string private _value;
    uint256 private _initiallyPopulatedValue = 12;

    event Store(string value);

    function initialize() external virtual initializer {
        __Ownable_init();
    }

    function store(string calldata boxValue) external onlyOwner {
        _value = boxValue;

        emit Store(_value);
    }

    function anotherStore(uint256 anotherValue) external onlyOwner {
        _initiallyPopulatedValue = anotherValue;
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
