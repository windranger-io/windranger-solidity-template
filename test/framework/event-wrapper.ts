import {expect} from 'chai'
import {
    Contract,
    ContractReceipt,
    ContractTransaction,
    Event,
    EventFilter,
    utils
} from 'ethers'
import {TypedEvent, TypedEventFilter} from '../../typechain-types/common'
import {ExtendedEventFilter, newExtendedEventFilter} from './event-filters'
import {EventListener} from './event-listener'

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

export type ContractReceiptSource =
    | ContractReceipt
    | Promise<ContractReceipt>
    | ContractTransaction
    | Promise<ContractTransaction>

export interface EventFactory<T = unknown> {
    expectOne(receipt: ContractReceipt, expected?: T): T

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

async function receiptOf(av: ContractReceiptSource): Promise<ContractReceipt> {
    const v = await av
    const receipt = 'gasUsed' in v ? v : await v.wait(1)

    // Transaction status code https://eips.ethereum.org/EIPS/eip-1066
    const SUCCESS = 1

    expect(receipt).is.not.undefined
    expect(receipt.status).equals(SUCCESS)
    return receipt
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
            const actuals = findEventArgs(this.toString(), receipt, emitter)
            const result: T[] = []
            const matched: boolean[] = new Array<boolean>(actuals.length)
            let prevActualIndex = -1

            for (let i = 0; i < expecteds.length; i++) {
                for (
                    let j = forwardOnly ? prevActualIndex + 1 : 0;
                    j < actuals.length;
                    j++
                ) {
                    if (!matched[j]) {
                        const actual = actuals[j]
                        if (this.matchArgs(actual, expecteds[i])) {
                            expect(j, 'Wrong order of events').gt(
                                prevActualIndex
                            )
                            prevActualIndex = j
                            matched[j] = true
                            result.push(actual as unknown as T)
                            break
                        }
                    }
                }
            }

            expect(result.length, 'Not all expected events were found').eq(
                expecteds.length
            )

            return result
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
            const receipt = await receiptOf(source)
            this.all(receipt, fn)
            return receipt
        }

        toString(): string {
            return this.name()
        }

        name(): string {
            return customName
        }

        verify(event: Event, expected?: T): T {
            expect(event.args).is.not.undefined
            expect(event.event).eq(this.toString())
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return this.verifyArgs(event.args!, expected)
        }

        verifyArgs(args: utils.Result, expected?: T): T {
            const n = this.toString()
            // eslint-disable-next-line no-undefined
            if (expected !== undefined) {
                _verifyByProperties(expected, n, args)
            }
            _verifyByFragment(emitter.interface.getEvent(n), n, args)
            return args as unknown as T
        }

        matchArgs(args: utils.Result, expected: Partial<T>): boolean {
            const n = this.toString()
            _verifyByFragment(emitter.interface.getEvent(n), n, args)
            return _matchByProperties(expected, args)
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

const _matchByProperties = <T>(
    expected: Partial<T>,
    args: utils.Result
): boolean =>
    !Object.entries(expected).some(
        (param): boolean =>
            // eslint-disable-next-line no-undefined
            param[1] !== undefined && args[param[0]] !== param[1]
    )

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
