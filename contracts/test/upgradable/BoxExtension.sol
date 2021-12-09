// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "../Box.sol";

/**
 * Contract adding a variable create a unique contract, that a Box may be upgraded as.
 */
contract BoxExtension is Box {
    uint256 private _difference;

    function initialize() public override initializer {
        Box.initialize();

        _difference = 7;
    }
}
