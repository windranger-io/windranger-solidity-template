import {storeEvent} from './box-events'
import {event} from '../framework/events'
import {expect} from 'chai'
import {ContractReceipt} from 'ethers'

/**
 * Verifies the StoreEvent, when expectation are not met the test fails.
 *
 * @param receipt expected to contain the StoreEvent, whose payload will be verified.
 * @param expectedValue expectation for the value field of the given StoreEvent.
 */
export function verifyStoreEvent(
    receipt: ContractReceipt,
    expectedValue: string
): void {
    const actualEvent = storeEvent(event('Store', receipt))

    expect(actualEvent.value, 'Store value does not match').equals(
        expectedValue
    )
}
