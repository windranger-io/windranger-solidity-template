// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Box.sol";

/**
 * Contract matching the data layout of the Box, but with an Enum definition.
 */
contract BoxWithEnum is OwnableUpgradeable {
    enum COUNT {
        ZERO,
        ONE,
        TWO
    }

    string private _value;
    COUNT private _cookiesConsumed;

    event Store(string value);

    function initialize() public virtual initializer {
        __Ownable_init();

        _value = "10";
        _cookiesConsumed = COUNT.TWO;
    }

    function store(string calldata boxValue) external onlyOwner {
        _value = boxValue;

        emit Store(_value);
    }

    function value() external view returns (string memory) {
        return _value;
    }
}
