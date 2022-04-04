/**
 * Events for an OpenZeppelin upgradeable contract.
 */
import {Event} from 'ethers'
import {expect} from 'chai'
import {
    AdminChangedEvent,
    UpgradedEvent
} from '../../../typechain-types/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable'

/**
 * Payload (parameters) for the UpgradedEvent.
 */
export type ActualUpgradedEvent = {
    implementation: string
}

export type ActualAdminChangedEvent = {
    previousAdmin: string
    newAdmin: string
}

/**
 * Shape check and conversion for a Admin Proxy's UpgradedEvent.
 */
export function upgradedEvent(event: Event): ActualUpgradedEvent {
    const upgrade = event as UpgradedEvent
    expect(upgrade.args).is.not.undefined

    const args = upgrade.args
    expect(args?.implementation).is.not.undefined

    return args
}

/**
 * Shape check and conversion for a Admin Proxy's UpgradedEvent.
 */
export function adminChangedEvent(event: Event): ActualAdminChangedEvent {
    const admin = event as AdminChangedEvent
    expect(admin.args).is.not.undefined

    const args = admin.args
    expect(args?.previousAdmin).is.not.undefined
    expect(args?.newAdmin).is.not.undefined

    return args
}
