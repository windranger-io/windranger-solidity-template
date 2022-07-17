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
import {EventListener} from './event-listener'

function findEventArgs(
    name: string,
    receipt: ContractReceipt,
    emitter?: Contract
): utils.Result[] {
    const found: utils.Result[] = []

    // eslint-disable-next-line no-undefined
    if (emitter === undefined) {
        for (const entry of receipt.events ?? []) {
            if (entry?.event === name) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                found.push(entry.args!)
            }
        }
    } else {
        const addr = emitter.address.toUpperCase()
        const parser = emitter.interface

        const fragment = parser.getEvent(name)
        const id = utils.id(fragment.format())

        for (const entry of receipt.logs) {
            if (
                entry.topics[0] === id &&
                entry.address.toUpperCase() === addr
            ) {
                const parsed = parser.decodeEventLog(
                    fragment,
                    entry.data,
                    entry.topics
                )
                found.push(parsed)
            }
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
    one(receipt: ContractReceipt, expected?: T): T

    all<Result = T[]>(
        receipt: ContractReceipt,
        fn?: (args: T[]) => Result
    ): Result

    waitAll(
        source: ContractReceiptSource,
        fn?: (args: T[]) => void
    ): Promise<ContractReceipt>

    toString(): string
    name(): string | undefined
}

export interface AttacheableEventFactory<T> extends EventFactory<T> {
    from(c: Contract): AttachedEventFactory<T>
}

export interface AttachedEventFactory<T> extends AttacheableEventFactory<T> {
    //    verify(event: Event, expected?: T): T
    newListener(): EventListener<T>
}

async function receiptOf(av: ContractReceiptSource): Promise<ContractReceipt> {
    const v = await av
    return 'gasUsed' in v ? v : v.wait(1)
}

const nameByFactory = new Map<EventFactory, string>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _wrap = <T, E extends TypedEvent<any, T>>(
    template: E, // only for type
    customName?: string,
    emitter?: Contract
): AttachedEventFactory<T> =>
    new (class implements AttachedEventFactory<T> {
        one(receipt: ContractReceipt, expected?: T): T {
            const args = findEventArgs(this.toString(), receipt, emitter)

            expect(
                args.length,
                `Expecting a single event ${this.toString()}`
            ).equals(1)
            return this.verifyArgs(args[0], expected)
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
            return this.name() ?? '<unknown>'
        }

        name(): string | undefined {
            return customName ?? nameByFactory.get(this)
        }

        from(c: Contract): AttachedEventFactory<T> {
            const fragment = c.interface.getEvent(this.toString())

            if (!fragment || fragment.anonymous) {
                throw new Error(
                    `Event ${this.toString()} is unknown to the contract`
                )
            }

            return _wrap(template, this.toString(), c)
        }

        verify(event: Event, expected?: Partial<T>): T {
            expect(event.args).is.not.undefined
            expect(event.event).eq(this.toString())
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return this.verifyArgs(event.args!, expected)
        }

        verifyArgs(args: utils.Result, expected?: Partial<T>): T {
            // eslint-disable-next-line no-undefined
            if (expected !== undefined) {
                _verifyByProperties(expected, this.toString(), args)

                // eslint-disable-next-line no-undefined
            } else if (emitter === undefined) {
                // this is not very good, but we dont have a real template
                for (const [propName, propValue] of Object.entries(
                    args as unknown as T
                )) {
                    expect(
                        propValue,
                        `${this.toString()}.${propName} is undefined`
                    ).is.not.undefined
                }
            } else {
                const n = this.toString()
                _verifyByFragment(emitter.interface.getEvent(n), n, args)
            }
            return args as unknown as T
        }

        newListener(): EventListener<T> {
            const n = this.toString()
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const em = emitter!

            const fragment = em.interface.getEvent(n)
            return new EventListener<T>(em, n, (event) => {
                const args = event.args ?? ({} as utils.Result)
                _verifyByFragment(fragment, n, args)
                return args as unknown as T
            })
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
): AttachedEventFactory<EventObjectType<E>> =>
    // eslint-disable-next-line no-undefined
    _wrap(null as unknown as E, name, emitter === null ? undefined : emitter)

export const newEventListener = <
    F extends EventFilters,
    N extends keyof F & string,
    E extends EventFilterType<ReturnType<F[N]>>
>(
    emitter: ContractEventFilters<F>,
    name: N
): EventListener<EventObjectType<E>> => eventOf(emitter, name).newListener()

export const eventTemplate = <T>(
    template: TypedEvent<unknown[], T>, // only as type, not as value
    customName?: string
): AttacheableEventFactory<T> => _wrap(template, customName)

export const addNamedEventTemplate = (f: EventFactory, name: string): void => {
    nameByFactory.set(f, name)
}
