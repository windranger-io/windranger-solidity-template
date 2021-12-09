// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * Contract matching the data layout of the Box, but with an self destruct used in a new function.
 */
contract BoxWithSelfDestruct is OwnableUpgradeable, UUPSUpgradeable {
    string private _value;

    event Store(string value);

    function doomed() external payable onlyOwner {
        selfdestruct(payable(owner()));
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

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
