// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Box.sol";

/**
 * Contract matching the data layout of the Box, but with a field initialised on construction.
 */
contract BoxWithInitialValueField is OwnableUpgradeable {
    string private _value;
    uint256 private _initiallyPopulated = 12;

    event Store(string value);

    function initialize() public virtual initializer {
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
