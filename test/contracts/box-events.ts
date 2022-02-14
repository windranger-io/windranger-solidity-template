import {Event} from 'ethers'
import {StoreEvent} from '../../typechain-types/Box'
import {expect} from 'chai'

/**
 * Validates the event shape and converts the arguments of a StoreEvent.
 *
 * @param event whose content is expected to match a StoreEvent.
 *              If expectation are not met, test will be failed.
 */
export function storeEvent(event: Event): {value: string} {
    const store = event as StoreEvent
    expect(store.args).is.not.undefined

    const args = store.args
    expect(args?.value).is.not.undefined

    return args
}
