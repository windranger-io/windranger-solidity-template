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

function eventsArg(
    name: string,
    receipt: ContractReceipt,
    emitter?: Contract
): unknown[] {
    const found: unknown[] = []

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

export interface EventFactory<TArgObj = unknown> {
    one<Result = TArgObj>(
        receipt: ContractReceipt,
        fn?: (args: TArgObj) => Result
    ): Result
    many<Result = TArgObj>(
        receipt: ContractReceipt,
        fn?: (args: TArgObj) => Result
    ): Result[]

    waitOne<Result = TArgObj>(
        source: ContractReceiptSource,
        fn?: (args: TArgObj) => Result
    ): Promise<Result>
    waitMany<Result = TArgObj>(
        source: ContractReceiptSource,
        fn?: (args: TArgObj) => Result
    ): Promise<Result[]>

    waitOneWithReceipt<Result = TArgObj>(
        source: ContractReceiptSource,
        fn?: (args: TArgObj) => Result
    ): Promise<{result: Result; receipt: ContractReceipt}>

    waitManyWithReceipt<Result = TArgObj>(
        source: ContractReceiptSource,
        fn?: (args: TArgObj) => Result
    ): Promise<{result: Result[]; receipt: ContractReceipt}>

    chainOne(
        source: ContractReceiptSource,
        fn: (args: TArgObj) => void
    ): Promise<ContractReceipt>
    chainMany(
        source: ContractReceiptSource,
        fn: (args: TArgObj) => void
    ): Promise<ContractReceipt>

    toString(): string
    name(): string | undefined
}

export interface AttacheableEventFactory<TArgObj = unknown>
    extends EventFactory<TArgObj> {
    from(c: Contract): AttachedEventFactory<TArgObj>
}

export interface AttachedEventFactory<TArgObj = unknown>
    extends AttacheableEventFactory<TArgObj> {
    verify(event: Event): TArgObj
    newListener(): EventListener<TArgObj>
}

async function receiptOf(av: ContractReceiptSource): Promise<ContractReceipt> {
    const v = await av
    return 'gasUsed' in v ? v : v.wait(1)
}

const nameByFactory = new Map<EventFactory, string>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _wrap = <TArgObj, E extends TypedEvent<any, TArgObj>>(
    template: E, // only for type
    customName?: string,
    emitter?: Contract
): AttachedEventFactory<TArgObj> =>
    new (class implements EventFactory<TArgObj> {
        one<Result = TArgObj>(
            receipt: ContractReceipt,
            fn?: (args: TArgObj) => Result
        ): Result {
            const args = eventsArg(
                this.toString(),
                receipt,
                emitter
            ) as TArgObj[]
            expect(args.length, 'Only one event expected').equals(1)

            const arg = args[0]

            // eslint-disable-next-line no-undefined
            if (fn === undefined) {
                return arg as unknown as Result
            }
            return fn(arg)
        }

        many<Result = TArgObj>(
            receipt: ContractReceipt,
            fn?: (args: TArgObj) => Result
        ): Result[] {
            const args = eventsArg(
                this.toString(),
                receipt,
                emitter
            ) as TArgObj[]

            // eslint-disable-next-line no-undefined
            if (fn === undefined) {
                return args as unknown[] as Result[]
            }

            const result: Result[] = []
            args.forEach((v) => result.push(fn(v)))
            return result
        }

        async waitOne<Result = TArgObj>(
            source: ContractReceiptSource,
            fn?: (args: TArgObj) => Result
        ): Promise<Result> {
            const receipt = await receiptOf(source)
            return this.one(receipt, fn)
        }

        async waitMany<Result = TArgObj>(
            source: ContractReceiptSource,
            fn?: (args: TArgObj) => Result
        ): Promise<Result[]> {
            const receipt = await receiptOf(source)
            return this.many(receipt, fn)
        }

        async waitOneWithReceipt<Result = TArgObj>(
            source: ContractReceiptSource,
            fn?: (args: TArgObj) => Result
        ): Promise<{result: Result; receipt: ContractReceipt}> {
            const receipt = await receiptOf(source)
            return {result: this.one(receipt, fn), receipt} as const
        }

        async waitManyWithReceipt<Result = TArgObj>(
            source: ContractReceiptSource,
            fn?: (args: TArgObj) => Result
        ): Promise<{result: Result[]; receipt: ContractReceipt}> {
            const receipt = await receiptOf(source)
            return {result: this.many(receipt, fn), receipt} as const
        }

        async chainOne(
            source: ContractReceiptSource,
            fn: (args: TArgObj) => void
        ): Promise<ContractReceipt> {
            const receipt = await receiptOf(source)
            this.one(receipt, fn)
            return receipt
        }

        async chainMany(
            source: ContractReceiptSource,
            fn: (args: TArgObj) => void
        ): Promise<ContractReceipt> {
            const receipt = await receiptOf(source)
            this.many(receipt, fn)
            return receipt
        }

        toString(): string {
            return this.name() ?? '<unknown>'
        }

        name(): string | undefined {
            return customName ?? nameByFactory.get(this)
        }

        from(c: Contract): AttachedEventFactory<TArgObj> {
            const fragment = c.interface.getEvent(this.toString())

            if (!fragment || fragment.anonymous) {
                throw new Error(
                    `Event ${this.toString()} is unknown to the contract`
                )
            }

            return _wrap(template, this.toString(), c)
        }

        verify(event: Event): TArgObj {
            expect(event.event).eq(this.toString())
            expect(event.args).is.not.undefined

            // eslint-disable-next-line no-undefined
            if (emitter === undefined) {
                const typedEvent = event as E
                const args = typedEvent.args as TArgObj

                // this is not very good, but we dont have a real template
                for (const [propName, propValue] of Object.entries(args)) {
                    expect(
                        propValue,
                        `${this.toString()}.${propName} is undefined`
                    ).is.not.undefined
                }
            } else {
                const n = this.toString()
                _verifyEventFragmentArgsObj(
                    emitter.interface.getEvent(n),
                    n,
                    event
                )
            }
            return event as unknown as TArgObj
        }

        newListener(): EventListener<TArgObj> {
            const n = this.toString()
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const fragment = emitter!.interface.getEvent(n)

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return new EventListener<TArgObj>(emitter!, n, (event) => {
                _verifyEventFragmentArgsObj(fragment, n, event)
                return event.args as unknown as TArgObj
            })
        }
    })()

const _verifyEventFragmentArgsObj = (
    fragment: utils.EventFragment,
    name: string,
    event: Event
) => {
    const args = event.args ?? []

    fragment.inputs.forEach((param) => {
        const propName = param.name
        expect(args[propName], `${name}.${propName} is undefined`).is.not
            .undefined
    })
}

export const addNamedEvent = (f: EventFactory, name: string): void => {
    nameByFactory.set(f, name)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventFilters = {[name: string]: (...args: Array<any>) => EventFilter}

class ContractEventFilters<F extends EventFilters> extends Contract {
    readonly filters!: F
}

type EventFilterType<T extends TypedEventFilter<TypedEvent>> =
    T extends TypedEventFilter<infer R extends TypedEvent> ? R : never

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventObjectType<T extends TypedEvent> = T extends TypedEvent<any, infer R>
    ? R
    : never

export const wrapContractEvent = <
    F extends EventFilters,
    N extends keyof F & string,
    E extends EventFilterType<ReturnType<F[N]>>
>(
    emitter: ContractEventFilters<F>,
    name: N
): AttachedEventFactory<EventObjectType<E>> =>
    // eslint-disable-next-line no-undefined
    _wrap(null as unknown as E, name, emitter === null ? undefined : emitter)

export const wrapTypedEvent = <TArgObj>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    template: TypedEvent<any, TArgObj>, // only for type
    customName?: string
): AttacheableEventFactory<TArgObj> => _wrap(template, customName)
