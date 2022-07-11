import {
    AdminChangedEvent,
    OwnershipTransferredEvent
} from '../../typechain-types/contracts/test/Box'
import {addNamedEvent, wrapTypedEvent} from './event-wrapper'

const stub = null as unknown
const wrap = wrapTypedEvent

export const Events = {
    AdminChanged: wrap(stub as AdminChangedEvent),
    OwnershipTransferred: wrap(stub as OwnershipTransferredEvent)
}

Object.entries(Events).forEach(([name, factory]) =>
    addNamedEvent(factory, name)
)
