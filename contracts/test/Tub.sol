// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title An storage tub for a string.
 *
 * @notice The storage tub can store a single string value, emit an event and also retrieve the stored value.
 *
 * @dev Event emitted on storing the value.
 */
contract Tub is Ownable {
    string private _value;

    event Store(string value);
    event IndexedEvent(string indexed boxValue, address[] nested);

    /**
     * @notice Permits the owner to store a value.
     *
     * @dev storing the value causes the Store event to be emitted, overwriting any previously stored value.
     *
     * @param boxValue value for storage in the Box, no restrictions.
     */
    function store(string calldata boxValue) external onlyOwner {
        _value = boxValue;

        emit Store(_value);
    }

    function multiStore(string[] calldata boxValues) external {
        for (uint256 i = 0; i < boxValues.length; i++) {
            emit Store(boxValues[i]);
        }
        if (boxValues.length > 0) {
            _value = boxValues[boxValues.length - 1];
        }
    }

    function nestedStore(string calldata boxValue, address[] calldata nested)
        external
    {
        _value = boxValue;

        emit Store(_value);

        if (nested.length > 0) {
            emit IndexedEvent(boxValue, nested);
            Tub(nested[0]).nestedStore(
                string(abi.encodePacked("+", boxValue)),
                nested[1:]
            );
        }
    }

    /**
     * @notice retrieves the stored value.
     *
     * @dev the Box stores only a single value.
     *
     * @return store value, which could be uninitialized.
     */
    function value() external view returns (string memory) {
        return _value;
    }
}
