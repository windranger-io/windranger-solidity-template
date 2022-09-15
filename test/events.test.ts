// Start - Support direct Mocha run & debug
import 'hardhat'
import '@nomiclabs/hardhat-ethers'
// End - Support direct Mocha run & debug

import chai, {expect} from 'chai'
import {solidity} from 'ethereum-waffle'
import {Tub} from '../typechain-types'
import {deployContract} from './framework/contracts'
import {
    successfulTransaction,
    expectEmittersAndEvents,
    expectEvents
} from '@windranger-io/windranger-tools-ethers'
import {utils} from 'ethers'
import {eventOf} from './framework/events'

// Wires up Waffle with Chai
chai.use(solidity)

// Demo of using events
describe('Events', () => {
    beforeEach(async () => {
        tub = await deployContract('Tub', [])
    })

    /* eslint-disable no-lone-blocks */

    describe('looking up events of one type', () => {
        it('single-event filter', async () => {
            const value = 'An important collection of characters'

            const receipt = await successfulTransaction(tub.store(value))

            // check for only one event of the given type and template
            eventOf(tub, 'Store').expectOne(receipt, {value})

            const eventStore = eventOf(tub, 'Store')

            // or get only one event of the given type
            const ev = eventStore.expectOne(receipt)
            expect(ev.value).eq(value)

            // access event fields as tuple
            const evT = eventStore.withTuple.expectOne(receipt)
            expect(evT.value).eq(value)
            expect(evT[0]).eq(value)
        })

        it('access an event as tuple', async () => {
            const value = 'An important collection of characters'

            const receipt = await successfulTransaction(tub.store(value))

            // check for only one event of the given type and template
            eventOf(tub, 'Store').expectOne(receipt, [value])

            // or get only one event of the given type
            const ev = eventOf(tub, 'Store').withTuple.expectOne(receipt)
            expect(ev[0]).eq(value)
        })

        it('all-event sync/async', async () => {
            const eventStore = eventOf(tub, 'Store')

            // can use async receiver to reduce code noise
            const receipt = await eventStore.waitAll(
                tub.multiStore(['1', '2', '3', '4', '5']),
                (events) => {
                    expect(events.length).eq(5)
                }
            )

            // or sync filtering and mapping from a receipt
            const mapped = eventStore.all(receipt, (events) =>
                events.map((ev) => ev.value)
            )
            expect(mapped).eqls(['1', '2', '3', '4', '5'])

            // or just get a list of
            const events = eventStore.all(receipt)
            expect(events.length).eq(5)
        })

        it('single-event filter', async () => {
            const value = 'An important collection of characters'

            const receipt = await successfulTransaction(tub.store(value))

            eventOf(tub, 'Store').expectOne(receipt, {value})
            expect(await tub.value()).equals(value)
        })

        /*
         * These examples are using object with named attributes to define event filters, attributes cam be omitted or nul
         * It is the best way, but events in Solidity must have names for relevant arguments
         */
        it('object-style filters', async () => {
            const receipt = await successfulTransaction(
                tub.multiStore(['1', '2', '3', '4', '5'])
            )

            const eventStore = eventOf(tub, 'Store')

            // pick an event by type and attribute match  => picks the first
            {
                const events = eventStore.expectOrdered(receipt, [{value: '1'}])
                expect(events.length).eq(1)
                expect(events[0].value).eq('1')
            }

            // pick an event by type and attribute match => picks the last
            {
                const events = eventStore.expectOrdered(receipt, [{value: '5'}])
                expect(events.length).eq(1)
                expect(events[0].value).eq('5')
            }

            // pick any first event of the given type
            {
                const events = eventStore.expectOrdered(receipt, [{}])
                expect(events.length).eq(1)
                expect(events[0].value).eq('1')
            }

            // pick two first event of the given type
            {
                const events = eventStore.expectOrdered(receipt, [{}, {}])
                expect(events.length).eq(2)
                expect(events[0].value).eq('1')
                expect(events[1].value).eq('2')
            }

            // pick one event by type and attribute match, and then a next one of the given type
            {
                // NB! without forwardOnly = true the 2nd filter will match the 1st event, not the 3rd one and will raise 'Wrong order of event'
                const events = eventStore.expectOrdered(
                    receipt,
                    [{value: '2'}, {}],
                    true
                )
                expect(events.length).eq(2)
                expect(events[0].value).eq('2')
                expect(events[1].value).eq('3')
            }

            // pick 2 events by type and attribute match, sequence must be retained, otherwise will fail
            {
                const events = eventStore.expectOrdered(receipt, [
                    {value: '2'},
                    {value: '5'}
                ])
                expect(events.length).eq(2)
                expect(events[0].value).eq('2')
                expect(events[1].value).eq('5')
            }
        })

        /*
         * These examples are using tuples to define event filters, attributes cam be omitted or nul
         * Applicable when filtering should use unnamed attributes of events
         */
        it('tuple-style filters', async () => {
            const receipt = await successfulTransaction(
                tub.multiStore(['1', '2', '3', '4', '5'])
            )

            const eventStore = eventOf(tub, 'Store')

            // pick an event by type and attribute match  => picks the first
            {
                const events = eventStore.expectOrdered(receipt, [['1']])
                expect(events.length).eq(1)
                expect(events[0].value).eq('1')
            }

            // pick an event by type and attribute match => picks the last
            {
                const events = eventStore.expectOrdered(receipt, [['5']])
                expect(events.length).eq(1)
                expect(events[0].value).eq('5')
            }

            // pick any first event of the given type
            {
                const events = eventStore.expectOrdered(receipt, [[]])
                expect(events.length).eq(1)
                expect(events[0].value).eq('1')
            }

            // pick two first event of the given type
            {
                const events = eventStore.expectOrdered(receipt, [[], []])
                expect(events.length).eq(2)
                expect(events[0].value).eq('1')
                expect(events[1].value).eq('2')
            }

            // pick one event by type and attribute match, and then a next one of the given type
            {
                // NB! without forwardOnly = true the 2nd filter will match the 1st event, not the 3rd one and will raise 'Wrong order of event'
                const events = eventStore.expectOrdered(
                    receipt,
                    [['2'], []],
                    true
                )
                expect(events.length).eq(2)
                expect(events[0].value).eq('2')
                expect(events[1].value).eq('3')
            }

            // pick 2 events by type and attribute match, sequence must be retained, otherwise will fail
            {
                const events = eventStore.expectOrdered(receipt, [['2'], ['5']])
                expect(events.length).eq(2)
                expect(events[0].value).eq('2')
                expect(events[1].value).eq('5')
            }
        })
    })

    describe('looking up events of different types and from different contracts', () => {
        it('single-event filters from a nested contract call', async () => {
            const tub1 = await deployContract('Tub', [])
            const tub2 = await deployContract('Tub', [])

            const eventIndexed1 = eventOf(tub1, 'IndexedEvent')

            // it calls `tub`, but filters events for `tub1`
            const receipt = await eventIndexed1.waitAll(
                tub.nestedStore('testValue', [tub1.address, tub2.address]),
                (events) => {
                    expect(events.length).eq(1)
                    expect(events[0].nested).eqls([tub2.address])
                }
            )

            const eventStore2 = eventOf(tub2, 'Store')

            // and can use the same receipt to filters events for `tub2`
            eventStore2.all(receipt, (events) => {
                expect(events.length).eq(1)
                expect(events[0].value).eq('++testValue')
            })
        })

        /*
         * These examples are using object with named attributes to define event filters, attributes cam be omitted or nul
         * It is the best way, but events in Solidity must have names for relevant arguments
         */
        it('object-style filters', async () => {
            const tub1 = await deployContract('Tub', [])
            const tub2 = await deployContract('Tub', [])

            const receipt = await successfulTransaction(
                tub.nestedStore('testValue', [tub1.address, tub2.address])
            )

            const eventStore0 = eventOf(tub, 'Store')
            const eventIndexed1 = eventOf(tub1, 'IndexedEvent')
            const eventStore2 = eventOf(tub2, 'Store')

            // pick the first event from tub with the given attribute, and the second from tub2 of the given type
            {
                const events = expectEvents(
                    receipt,
                    eventStore0.newFilter({value: 'testValue'}),
                    eventStore2.newFilter({})
                )
                expect(events.length).eq(2)
                expect(events[0].value).eq('testValue')
                expect(events[1].value).eq('++testValue')
            }

            // pick the first event from tub1 with the given indexed attribute, and the second from tub2 of the different
            {
                const events = expectEvents(
                    receipt,
                    // indexed strings/bytes can be used as filters, but cant be decoded into original values
                    eventIndexed1.newFilter({boxValue: '+testValue'}),
                    eventStore2.newFilter() // same as newFilter({})
                )
                expect(events.length).eq(2)

                /*
                 * ATTN! indexed strings/bytes can be used as filters, but cant be decoded into original values
                 * so ethers provides them as the special Indexed type
                 */
                expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true

                expect(events[0].nested).eqls([tub2.address])
                expect(events[1].value).eq('++testValue')
            }

            // pick the event from tub1 by the array attribute
            {
                const events = expectEvents(
                    receipt,
                    // indexed strings/bytes can be used as filters, but cant be decoded into original values
                    eventIndexed1.newFilter({nested: [tub2.address]})
                )
                expect(events.length).eq(1)

                expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true
                expect(events[0].nested).eqls([tub2.address])
            }

            /*
             * pick seqeunce of 3 events of the given type but from ANY contracts
             * ATTN! collision is possible as events are matched by topic0 only
             */
            {
                const [emitters, events] = expectEmittersAndEvents(
                    receipt,
                    true,
                    eventStore0.newFilter({}, '*'), // allows matching of any emitter
                    eventStore0.newFilter({}, '*'),
                    eventStore0.newFilter({}, '*')
                )
                expect(emitters).eqls([tub.address, tub1.address, tub2.address])
                expect(events.length).eq(3)
                expect(events[0].value).eq('testValue')
                expect(events[1].value).eq('+testValue')
                expect(events[2].value).eq('++testValue')
            }
        })

        /*
         * These examples are using tuples to define event filters, attributes cam be omitted or nul
         * Applicable when filtering should use unnamed attributes of events
         */
        it('tuple-style filters', async () => {
            const tub1 = await deployContract('Tub', [])
            const tub2 = await deployContract('Tub', [])

            const receipt = await successfulTransaction(
                tub.nestedStore('testValue', [tub1.address, tub2.address])
            )

            const eventStore0 = eventOf(tub, 'Store')
            const eventIndexed1 = eventOf(tub1, 'IndexedEvent')
            const eventStore2 = eventOf(tub2, 'Store')

            // pick the first event from tub with the given attribute, and the second from tub2 of the given type
            {
                const events = expectEvents(
                    receipt,
                    eventStore0.newFilter(['testValue']),
                    eventStore2.newFilter([])
                )
                expect(events.length).eq(2)
                expect(events[0].value).eq('testValue')
                expect(events[1].value).eq('++testValue')
            }

            // pick the first event from tub1 with the given indexed attribute, and the second from tub2 of the different
            {
                const events = expectEvents(
                    receipt,
                    // indexed strings/bytes can be used as filters, but cant be decoded into original values
                    eventIndexed1.newFilter(['+testValue']),
                    eventStore2.newFilter() // same as newFilter({})
                )
                expect(events.length).eq(2)

                /*
                 * ATTN! indexed strings/bytes can be used as filters, but cant be decoded into original values
                 * so ethers provides them as the special Indexed type
                 */
                expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true

                expect(events[0].nested).eqls([tub2.address])
                expect(events[1].value).eq('++testValue')
            }

            // pick the event from tub1 by the array attribute
            {
                const events = expectEvents(
                    receipt,
                    /*
                     * arrays and structs are suitable for filtering
                     * Note that the tuple allows elements to be null or omitted (sparse array)
                     */
                    eventIndexed1.newFilter([null, [tub2.address]])
                )
                expect(events.length).eq(1)

                expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true
                expect(events[0].nested).eqls([tub2.address])
            }

            /*
             * pick seqeunce of 3 events of the given type but from ANY contracts
             * ATTN! collision is possible as events are matched by topic0 only
             */
            {
                const [emitters, events] = expectEmittersAndEvents(
                    receipt,
                    true,
                    eventStore0.newFilter([], '*'), // allows matching of any emitter
                    eventStore0.newFilter([], '*'),
                    eventStore0.newFilter([], '*')
                )
                expect(emitters).eqls([tub.address, tub1.address, tub2.address])
                expect(events.length).eq(3)
                expect(events[0].value).eq('testValue')
                expect(events[1].value).eq('+testValue')
                expect(events[2].value).eq('++testValue')
            }
        })

        /*
         * These examples are using object and tuple to define event filters, attributes cam be omitted or nul
         * Applicable when filtering should use unnamed attributes of events
         */
        it('mix-style filters', async () => {
            const tub1 = await deployContract('Tub', [])
            const tub2 = await deployContract('Tub', [])

            const receipt = await successfulTransaction(
                tub.nestedStore('testValue', [tub1.address, tub2.address])
            )

            const eventIndexed1 = eventOf(tub1, 'IndexedEvent')

            // pick the event from tub1 by attributes
            {
                const events = expectEvents(
                    receipt,
                    // Attributes can be defined by both name and index
                    eventIndexed1.newFilter({
                        boxValue: '+testValue',
                        1: [tub2.address]
                    })
                )
                expect(events.length).eq(1)

                expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true
                expect(events[0].nested).eqls([tub2.address])
            }

            /*
             * tuple attributes are hidden by default on the resulting object
             * to access them use withTuple
             */
            {
                const events = expectEvents(
                    receipt,
                    // Attributes can be defined by both name and index
                    eventIndexed1.withTuple.newFilter({
                        boxValue: '+testValue',
                        1: [tub2.address]
                    })
                )
                expect(events.length).eq(1)

                expect(utils.Indexed.isIndexed(events[0][0])).is.true
                expect(events[0][1]).eqls([tub2.address])
            }
        })
    })

    let tub: Tub
})
