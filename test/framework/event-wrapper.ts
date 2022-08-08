import {expect} from 'chai'
import {Contract, ContractReceipt, EventFilter, utils} from 'ethers'
import {TypedEvent, TypedEventFilter} from '../../typechain-types/common'
import {
    expectEmittersAndEvents,
    ExtendedEventFilter,
    newExtendedEventFilter
} from './event-filters'
import {EventListener} from './event-listener'
import {ContractReceiptSource, successfulTransaction} from './transaction'

function findEventArgs(
    name: string,
    receipt: ContractReceipt,
    emitter: Contract
): utils.Result[] {
    const found: utils.Result[] = []

    const addr = emitter.address.toUpperCase()
    const parser = emitter.interface

    const fragment = parser.getEvent(name)
    const id = utils.id(fragment.format())

    for (const entry of receipt.logs) {
        if (entry.topics[0] === id && entry.address.toUpperCase() === addr) {
            const parsed = parser.decodeEventLog(
                fragment,
                entry.data,
                entry.topics
            )
            found.push(parsed)
        }
    }

    expect(
        found.length,
        `Failed to find any event matching name: ${name}`
    ).is.greaterThan(0)

    return found
}

export interface EventFactory<T = unknown> {
    expectOne(receipt: ContractReceipt, expected?: T): T

    /**
     * Parses logs of the receipt by the given filters.
     * This function matches the provided sequence of filters agains logs.
     *
     * When forwardOnly is false only a matched log entry is removed from further matching;
     * othterwise, all log entries before the matched entry are also excluded.
     * Use forwardOnly = false for a distinct set of events to make sure that ordering is correct.
     * Use forwardOnly = true to extract a few events of the same type when some of events are exact and some are not.
     *
     * NB! This function have a special handling for `indexed` event arguments
     * of dynamic types (`string`, `bytes`, `arrays`) - these types can be used
     * for filtering, but decoded fields will not have values, but special
     * Indexed objects with hash.
     *
     * Throws an error when:
     * - a filter N matches a log entry with lower index than a filter N-1
     * - not all filters have a match
     *
     * @param receipt to provide logs for parsing
     * @param expecteds a set of filters to match and parse log entries
     * @param forwardOnly prevents backward logs matching when is true
     * @return a set of parsed log entries matched by filters
     */
    expectOrdered(
        receipt: ContractReceipt,
        expecteds: Partial<T>[],
        forwardOnly?: boolean
    ): T[]

    all<Result = T[]>(
        receipt: ContractReceipt,
        fn?: (args: T[]) => Result
    ): Result

    waitAll(
        source: ContractReceiptSource,
        fn?: (args: T[]) => void
    ): Promise<ContractReceipt>

    toString(): string
    name(): string

    newListener(): EventListener<T>
    newFilter(
        args?: Partial<T>,
        emitterAddress?: string | '*'
    ): ExtendedEventFilter<T>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _wrap = <T, E extends TypedEvent<any, T>>(
    template: E, // only for type
    customName: string,
    emitter: Contract
): EventFactory<T> =>
    new (class implements EventFactory<T> {
        expectOne(receipt: ContractReceipt, expected?: T): T {
            const args = findEventArgs(this.toString(), receipt, emitter)

            expect(
                args.length,
                `Expecting a single event ${this.toString()}`
            ).equals(1)
            return this.verifyArgs(args[0], expected)
        }

        expectOrdered(
            receipt: ContractReceipt,
            expecteds: Partial<T>[],
            forwardOnly?: boolean
        ): T[] {
            const filters = expecteds.map((expected) =>
                this.newFilter(expected)
            )
            const [, events] = expectEmittersAndEvents(
                receipt,
                forwardOnly ?? false,
                ...filters
            )
            return events
        }

        all<Result = T[]>(
            receipt: ContractReceipt,
            fn?: (args: T[]) => Result
        ): Result {
            const args = findEventArgs(this.toString(), receipt, emitter)

            // eslint-disable-next-line no-undefined
            if (fn === undefined) {
                args.forEach((arg): void => {
                    this.verifyArgs(arg)
                })
                return args as unknown as Result
            }

            return fn(args as unknown as T[])
        }

        async waitAll(
            source: ContractReceiptSource,
            fn?: (args: T[]) => void
        ): Promise<ContractReceipt> {
            const receipt = await successfulTransaction(source)
            this.all(receipt, fn)
            return receipt
        }

        toString(): string {
            return this.name()
        }

        name(): string {
            return customName
        }

        private verifyArgs(args: utils.Result, expected?: T): T {
            const n = this.toString()
            // eslint-disable-next-line no-undefined
            if (expected !== undefined) {
                _verifyByProperties(expected, n, args)
            }
            _verifyByFragment(emitter.interface.getEvent(n), n, args)
            return args as unknown as T
        }

        newListener(): EventListener<T> {
            const n = this.toString()

            const fragment = emitter.interface.getEvent(n)
            return new EventListener<T>(emitter, n, (event) => {
                const args = event.args ?? ({} as utils.Result)
                _verifyByFragment(fragment, n, args)
                return args as unknown as T
            })
        }

        newFilter(
            filter?: Partial<T>,
            emitterAddress?: string
        ): ExtendedEventFilter<T> {
            const n = this.toString()
            return newExtendedEventFilter<T>(
                n,
                emitterAddress ?? emitter.address,
                emitter.interface,
                filter ?? {}
            )
        }
    })()

const _verifyByFragment = (
    fragment: utils.EventFragment,
    name: string,
    args: utils.Result
) => {
    fragment.inputs.forEach((param) => {
        const propName = param.name
        expect(args[propName], `Property ${name}.${propName} is undefined`).is
            .not.undefined
    })
}

const _verifyByProperties = <T>(
    expected: T,
    name: string,
    args: utils.Result
) => {
    Object.entries(expected).forEach((param) => {
        const propName = param[0]
        expect(
            args[propName],
            `Mismatched value of property ${name}.${propName}`
        ).eq(param[1])
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventFilters = {[name: string]: (...args: Array<any>) => EventFilter}

class ContractEventFilters<F extends EventFilters> extends Contract {
    readonly filters!: F
}

type EventFilterType<T extends TypedEventFilter<TypedEvent>> =
    T extends TypedEventFilter<infer R extends TypedEvent> ? R : never

type EventObjectType<T extends TypedEvent> = T extends TypedEvent<
    unknown[],
    infer R
>
    ? R
    : never

export const eventOf = <
    F extends EventFilters,
    N extends keyof F & string,
    E extends EventFilterType<ReturnType<F[N]>>
>(
    emitter: ContractEventFilters<F>,
    name: N
): EventFactory<EventObjectType<E>> =>
    _wrap(null as unknown as E, name, emitter)

export const newEventListener = <
    F extends EventFilters,
    N extends keyof F & string,
    E extends EventFilterType<ReturnType<F[N]>>
>(
    emitter: ContractEventFilters<F>,
    name: N
): EventListener<EventObjectType<E>> => eventOf(emitter, name).newListener()
