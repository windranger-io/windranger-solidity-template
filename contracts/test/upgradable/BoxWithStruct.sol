// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * Contract matching the data layout of the Box, but with an Struct definition.
 */
contract BoxWithStruct is OwnableUpgradeable, UUPSUpgradeable {
    struct CookiesEaten {
        uint256 count;
    }

    string private _value;
    CookiesEaten private _consumption;

    event Store(string value);

    function initialize() external virtual initializer {
        __Ownable_init();

        _value = "13";
        _consumption = CookiesEaten({count: 55});
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
