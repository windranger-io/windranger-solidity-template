import {ContractReceipt, utils} from 'ethers'
import {Log} from '@ethersproject/abstract-provider'
import {expect} from 'chai'
import {TypedEvent, TypedEventFilter} from '../../typechain-types/common'

type DecodeFunc = (log: Log) => utils.Result

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ExtendedEventFilter<T = any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extends TypedEventFilter<TypedEvent<any[], T>> {
    nonIndexed?: Record<string, unknown>
    decodeEventData: DecodeFunc
}

/*
 * function decodeEventLogs(
 *     logs: Array<Log>,
 *     decoderLookup: (emitter: string, topic0: string) => (DecodeFunc | undefined)
 * ): utils.Result[] {
 *     const found: utils.Result[] = []
 *     for (const entry of logs) {
 *         const decodeFn = decoderLookup(entry.address.toUpperCase(), entry.topics[0])
 *         if (decodeFn !== undefined) {
 *             found.push(decodeFn(entry.data,entry.topics))
 *         }
 *     }
 *     return found
 * }
 */

/*
 * function filtersToDecoders(filters: Array<ExtendedEventFilter<any>>) : Map<string, Map<string, DecodeFunc>> {
 *     const result = new Map<string, Map<string, DecodeFunc>>();
 *     for (const filter of filters) {
 *         if (filter.address && filter.topics) {
 *             const eventType = filter.topics[0];
 *             if (typeof eventType === 'string') {
 *                 const addr = filter.address.toUpperCase()
 *                 let subMap = result.get(addr)
 *                 if (subMap === undefined) {
 *                     subMap = new Map<string, DecodeFunc>()
 *                     result.set(addr, subMap)
 *                 }
 *                 subMap.set(eventType, filter.decodeEventData)
 *             }
 *         }
 *     }
 *     return result;
 * }
 */

type UnwrapEventFilter<T> = T extends ExtendedEventFilter<infer R> ? R : never

type UnwrapEventFilters<T extends [...ExtendedEventFilter[]]> = T extends [
    infer Head extends ExtendedEventFilter,
    ...infer Tail extends [...ExtendedEventFilter[]]
]
    ? [UnwrapEventFilter<Head>, ...UnwrapEventFilters<Tail>]
    : []

export function expectEvents<T extends ExtendedEventFilter[]>(
    receipt: ContractReceipt,
    ...filters: T
): UnwrapEventFilters<T> {
    const [, result] = _orderedFilter(receipt.logs, filters, false)
    return result as UnwrapEventFilters<T>
}

export function expectEmittersAndEvents<T extends ExtendedEventFilter[]>(
    receipt: ContractReceipt,
    forwardOnly: boolean,
    ...filters: T
): [string[], UnwrapEventFilters<T>] {
    const [emitters, result] = _orderedFilter(
        receipt.logs,
        filters,
        forwardOnly
    )
    return [emitters, result as UnwrapEventFilters<T>]
}

function _orderedFilter(
    actuals: Array<Log>,
    expecteds: ExtendedEventFilter[],
    forwardOnly?: boolean
): [string[], utils.Result[]] {
    const result: utils.Result[] = []
    const resultAddr: string[] = []
    const matched: boolean[] = new Array<boolean>(actuals.length)
    let prevActualIndex = -1

    for (let i = 0; i < expecteds.length; i++) {
        for (
            let j = forwardOnly ? prevActualIndex + 1 : 0;
            j < actuals.length;
            j++
        ) {
            if (matched[j]) {
                // eslint-disable-next-line no-continue
                continue
            }
            const actual = actuals[j]
            const expected = expecteds[i]
            if (_matchTopics(actual, expected)) {
                const decoded = expected.decodeEventData(actual)
                if (
                    // eslint-disable-next-line no-undefined
                    expected.nonIndexed === undefined ||
                    _matchProperties(decoded, expected.nonIndexed)
                ) {
                    expect(j, 'Wrong order of events').gt(prevActualIndex)
                    prevActualIndex = j
                    matched[j] = true
                    result.push(decoded)
                    resultAddr.push(actual.address)
                    break
                }
            }
        }
    }

    expect(result.length, 'Not all expected events were found').eq(
        expecteds.length
    )

    return [resultAddr, result]
}

function _matchTopics(actual: Log, expected: ExtendedEventFilter): boolean {
    // eslint-disable-next-line no-undefined
    if (expected.address !== undefined && actual.address !== expected.address) {
        return false
    }

    let i = -1
    for (const expectedTopic of expected.topics ?? []) {
        i++
        if (i >= actual.topics.length) {
            return false
        }
        if (expectedTopic !== null && expectedTopic !== actual.topics[i]) {
            return false
        }
    }

    return true
}

function _matchProperties(
    actual: utils.Result,
    expected: Record<string, unknown>
): boolean {
    for (const propName in expected) {
        if (actual[propName] !== expected[propName]) {
            return false
        }
    }
    return true
}

export function newExtendedEventFilter<T>(
    eventName: string,
    emitter: string,
    decoder: utils.Interface,
    filter: Partial<T>
): ExtendedEventFilter<T> {
    let address: string | undefined
    if (emitter !== '*') {
        expect(utils.isAddress(emitter), 'Invalid address').is.true
        address = emitter
    }

    const fragment = decoder.getEvent(eventName)
    const [args, nonIndexed] = _buildFilterArgs(fragment, filter)

    return {
        address,
        topics: decoder.encodeFilterTopics(fragment, args),
        nonIndexed: nonIndexed,
        decodeEventData(log: Log): utils.Result {
            return decoder.decodeEventLog(fragment, log.data, log.topics)
        }
    }
}

const _buildFilterArgs = (
    fragment: utils.EventFragment,
    properties: Record<string, unknown>
): [unknown[], Record<string, unknown> | undefined] => {
    const indexed: unknown[] = []
    const nonIndexedObj: Record<string, unknown> = {}
    let hasNonIndexed = false

    let propertiesCount = 0
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const key in properties) {
        propertiesCount++
    }

    if (propertiesCount > 0) {
        fragment.inputs.forEach((param) => {
            let value = properties[param.name]
            // eslint-disable-next-line no-undefined
            if (value === undefined) {
                value = null
            } else {
                propertiesCount--
            }
            if (param.indexed) {
                indexed.push(value)
            } else {
                indexed.push(null)
                if (value !== null) {
                    nonIndexedObj[param.name] = value
                    hasNonIndexed = true
                }
            }
        })
        expect(propertiesCount, 'Inconsistend set of properties').eq(0)
    }

    // eslint-disable-next-line no-undefined
    return [indexed, hasNonIndexed ? nonIndexedObj : undefined]
}
