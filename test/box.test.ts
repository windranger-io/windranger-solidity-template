// Start - Support direct Mocha run & debug
import 'hardhat'
import '@nomiclabs/hardhat-ethers'
// End - Support direct Mocha run & debug

import chai, {expect} from 'chai'
import {before} from 'mocha'
import {solidity} from 'ethereum-waffle'
import {Box} from '../typechain-types'
import {deployContract, signer} from './framework/contracts'
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {successfulTransaction} from './framework/transaction'
import {eventOf} from './framework/event-wrapper'

// Wires up Waffle with Chai
chai.use(solidity)

/*
 * The below comments are only for explaining the test layout.
 *
 * Actual tests do not need them, instead should practice code as documentation.
 */

// Start with the contract name as the top level descriptor
describe('Box', () => {
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
        box = await deployContract<Box>('Box')
        await successfulTransaction(box.initialize())
    })

    // Inner describes use the name or idea for the function they're unit testing
    describe('store', () => {
        /*
         * Describe 'it', what unit of logic is being tested
         * Keep in mind the full composition of the name: Box > store > value
         */
        it('value', async () => {
            const value = 'An important collection of characters'

            const receipt = await successfulTransaction(box.store(value))

            eventOf(box, 'Store').expectOne(receipt, {value})

            expect(await box.value()).equals(value)
        })

        // Modifier checks contain the flattened and spaced modifier name
        it('only owner', async () => {
            await expect(box.connect(observer).store('')).to.be.revertedWith(
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
            box.connect(admin).store(valueOne)
        )

        const eventStore = eventOf(box, 'Store')

        eventStore.expectOne(receiptOne, {value: valueOne})
        expect(await box.connect(observer).value()).equals(valueOne)

        // Overwriting the stored value
        const valueTwo =
            'Second selection of important characters, overwriting the first'
        const receiptTwo = await successfulTransaction(
            box.connect(admin).store(valueTwo)
        )

        eventStore.expectOne(receiptTwo, {value: valueTwo})
        expect(await box.connect(observer).value()).equals(valueTwo)
    })

    let admin: SignerWithAddress
    let observer: SignerWithAddress
    let box: Box
})
