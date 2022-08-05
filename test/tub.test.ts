// Start - Support direct Mocha run & debug
import 'hardhat'
import '@nomiclabs/hardhat-ethers'
// End - Support direct Mocha run & debug

import chai, {expect} from 'chai'
import {before} from 'mocha'
import {solidity} from 'ethereum-waffle'
import {Tub} from '../typechain-types'
import {deployContract, signer} from './framework/contracts'
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {successfulTransaction} from './framework/transaction'
import {eventOf} from './framework/event-wrapper'
import {expectEmittersAndEvents, expectEvents} from './framework/event-filters'
import {utils} from 'ethers'

// Wires up Waffle with Chai
chai.use(solidity)

/*
 * The below comments are only for explaining the test layout.
 *
 * Actual tests do not need them, instead should practice code as documentation.
 */

// Start with the contract name as the top level descriptor
describe('Tub', () => {
    /*
     * Once and before any test, get a handle on the signer and observer
     * (only put variables in before, when their state is not affected by any test)
     */
    before(async () => {
        admin = await signer(0)
        observer = await signer(1)
    })

    // Before each test, deploy a fresh box (clean starting state)
    beforeEach(async () => {
        tub = await deployContract<Tub>('Tub')
    })

    // Inner describes use the name or idea for the function they're unit testing
    describe('store', () => {
        /*
         * Describe 'it', what unit of logic is being tested
         * Keep in mind the full composition of the name: Box > store > value
         */
        it('value', async () => {
            const value = 'An important collection of characters'

            const receipt = await successfulTransaction(tub.store(value))

            eventOf(tub, 'Store').expectOne(receipt, {value})

            expect(await tub.value()).equals(value)
        })

        // Modifier checks contain the flattened and spaced modifier name
        it('only owner', async () => {
            await expect(tub.connect(observer).store('')).to.be.revertedWith(
                'Ownable: caller is not the owner'
            )
        })
    })

    /*
     * Top level IT describes complex interactions
     * Beyond the scope of a single function, closer to a use case flow than UT
     */
    it('owner overwrites initial value, with observer verifying', async () => {
        const valueOne = 'First selection of important characters'
        const receiptOne = await successfulTransaction(
            tub.connect(admin).store(valueOne)
        )

        const storeEvent = eventOf(tub, 'Store')

        storeEvent.expectOne(receiptOne, {value: valueOne})
        expect(await tub.connect(observer).value()).equals(valueOne)

        // Overwriting the stored value
        const valueTwo =
            'Second selection of important characters, overwriting the first'
        const receiptTwo = await successfulTransaction(
            tub.connect(admin).store(valueTwo)
        )

        storeEvent.expectOne(receiptTwo, {value: valueTwo})
        expect(await tub.connect(observer).value()).equals(valueTwo)
    })

    /* eslint-disable no-lone-blocks */

    it('multiple event handling', async () => {
        const receipt = await successfulTransaction(
            tub.multiStore(['1', '2', '3', '4', '5'])
        )

        const eventStore = eventOf(tub, 'Store')

        {
            const events = eventStore.expectOrdered(receipt, [{value: '1'}])
            expect(events.length).eq(1)
            expect(events[0].value).eq('1')
        }

        {
            const events = eventStore.expectOrdered(receipt, [{value: '5'}])
            expect(events.length).eq(1)
            expect(events[0].value).eq('5')
        }

        {
            const events = eventStore.expectOrdered(receipt, [{}])
            expect(events.length).eq(1)
            expect(events[0].value).eq('1')
        }

        {
            const events = eventStore.expectOrdered(receipt, [{}, {}])
            expect(events.length).eq(2)
            expect(events[0].value).eq('1')
            expect(events[1].value).eq('2')
        }

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

    it('nested event handling', async () => {
        const tub1 = await deployContract<Tub>('Tub')
        const tub2 = await deployContract<Tub>('Tub')

        const receipt = await successfulTransaction(
            tub.nestedStore('testValue', [tub1.address, tub2.address])
        )

        const eventStore0 = eventOf(tub, 'Store')
        const eventIndexed1 = eventOf(tub1, 'IndexedEvent')
        const eventStore2 = eventOf(tub2, 'Store')

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

        {
            const events = expectEvents(
                receipt,
                // indexed strings/bytes can be used as filters, but cant be decoded into original values
                eventIndexed1.newFilter({boxValue: '+testValue'}),
                eventStore2.newFilter() // same as newFilter({})
            )
            expect(events.length).eq(2)

            // indexed strings/bytes can be used as filters, but cant be decoded into original values
            expect(utils.Indexed.isIndexed(events[0].boxValue)).is.true
            expect(events[0].nested).eqls([tub2.address])

            expect(events[1].value).eq('++testValue')
        }

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

    let admin: SignerWithAddress
    let observer: SignerWithAddress
    let tub: Tub
})
