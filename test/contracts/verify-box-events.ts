import {storeEvent} from './box-events'
import {event} from '../framework/events'
import {expect} from 'chai'
import {ContractReceipt} from 'ethers'

export type ExpectStoreEvent = {value: string}

/**
 * Verifies the StoreEvent, when expectation are not met the test fails.
 *
 * @param receipt expected to contain the StoreEvent, whose payload will be verified.
 * @param expected expectation for the value field of the given StoreEvent.
 */
export function verifyStoreEvent(
    receipt: ContractReceipt,
    expected: ExpectStoreEvent
): void {
    const actualEvent = storeEvent(event('Store', receipt))

    expect(actualEvent.value, 'Store value does not match').equals(
        expected.value
    )
}
