import {ContractReceipt, utils} from 'ethers'
import {Log} from '@ethersproject/abstract-provider'
import {expect} from 'chai'
import {TypedEvent, TypedEventFilter} from '../../typechain-types/common'

type EventDataDecoder = (log: Log) => utils.Result

export interface ExtendedEventFilter<T = object>
    extends TypedEventFilter<TypedEvent<unknown[], T>> {
    nonIndexed?: Record<string, unknown>
    decodeEventData: EventDataDecoder
}

function decodeEventLogs(
    logs: Array<Log>,
    decoderLookup: (
        emitter: string,
        topic0: string
    ) => EventDataDecoder | undefined
): utils.Result[] {
    const found: utils.Result[] = []
    for (const entry of logs) {
        const decodeFn = decoderLookup(
            entry.address.toUpperCase(),
            entry.topics[0]
        )
        // eslint-disable-next-line no-undefined
        if (decodeFn !== undefined) {
            found.push(decodeFn(entry))
        }
    }
    return found
}

function filtersToDecoders(
    filters: Array<ExtendedEventFilter>
): Map<string, Map<string, EventDataDecoder>> {
    const result = new Map<string, Map<string, EventDataDecoder>>()
    for (const filter of filters) {
        if (filter.address && filter.topics) {
            const eventType = filter.topics[0]
            if (typeof eventType === 'string') {
                const addr = filter.address.toUpperCase()
                let subMap = result.get(addr)
                // eslint-disable-next-line no-undefined
                if (subMap === undefined) {
                    subMap = new Map<string, EventDataDecoder>()
                    result.set(addr, subMap)
                }
                subMap.set(eventType, filter.decodeEventData)
            }
        }
    }
    return result
}

/**
 * Parses logs for the specific event type
 *
 * @param logs to be parsed
 * @param filter to pick and decode log entries
 */
export function filterEventFromLog<T>(
    logs: Array<Log>,
    filter: ExtendedEventFilter<T>
): T[] {
    const decoders = filtersToDecoders([filter])
    return decodeEventLogs(logs, (emitter, topic) =>
        decoders.get(emitter)?.get(topic)
    ) as unknown[] as T[]
}

type UnwrapEventFilter<T> = T extends ExtendedEventFilter<infer R> ? R : never

type UnwrapEventFilters<T extends [...ExtendedEventFilter[]]> = T extends [
    infer Head extends ExtendedEventFilter,
    ...infer Tail extends [...ExtendedEventFilter[]]
]
    ? [UnwrapEventFilter<Head>, ...UnwrapEventFilters<Tail>]
    : []

/**
 * Parses logs of the receipt by the given filters.
 * This function matches the provided sequence of filters agains logs.
 * A matched log entry is removed from further matching.
 *
 * Throws an error when:
 * - a filter N matches a log entry with lower index than a filter N-1
 * - not all filters have a match
 *
 * NB! This function have a special handling for `indexed` event arguments
 * of dynamic types (`string`, `bytes`, `arrays`) - these types can be used
 * for filtering, but decoded fields will not have values, but special
 * Indexed objects with hash.
 *
 * @param receipt to provide logs for parsing
 * @param filters a set of filters to match and parse log entries
 * @return a set of parsed log entries matched by the filters
 */
export function expectEvents<T extends ExtendedEventFilter[]>(
    receipt: ContractReceipt,
    ...filters: T
): UnwrapEventFilters<T> {
    const [, result] = _orderedFilter(receipt.logs, filters, false)
    return result as UnwrapEventFilters<T>
}

/**
 * Parses logs of the receipt by the given filters.
 * This function matches the provided sequence of filters agains logs.
 * This function also returns emmitters of the matched events, so it is
 * usable with filters where an emitter is not specified.
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
 * @param forwardOnly prevents backward logs matching when is true
 * @param filters a set of filters to match and parse log entries
 * @return a set of emmitters and parsed log entries matched by the filters
 */
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
    if (
        // eslint-disable-next-line no-undefined
        expected.address !== undefined &&
        actual.address.toUpperCase() !== expected.address.toUpperCase()
    ) {
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
