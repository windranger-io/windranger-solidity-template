// Start - Support direct Mocha run & debug
import 'hardhat'
import '@nomiclabs/hardhat-ethers'
import '@openzeppelin/hardhat-upgrades'
// End - Support direct Mocha run & debug

import chaiAsPromised from 'chai-as-promised'
import chai, {expect} from 'chai'
import {before} from 'mocha'
import {solidity} from 'ethereum-waffle'
import {
    deployContractWithProxy,
    signer,
    upgradeContract
} from './framework/contracts'
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {occurrenceAtMost} from './framework/time'
import {EventListener} from './framework/event-listener'
import {ethers} from 'ethers'
import {
    Box,
    BoxExtension,
    BoxTransparentProxy,
    BoxWithConstructor,
    BoxWithEnum,
    BoxWithImmutableField,
    BoxWithInitialValueField,
    BoxWithSelfDestruct,
    BoxWithStruct
} from '../typechain-types'
import {newEventListener} from './framework/event-wrapper'
import {UpgradedEventObject} from '../typechain-types/contracts/test/Box'

// Wires Chai with Waffle and Promises
chai.use(solidity)
chai.use(chaiAsPromised)

const MAXIMUM_WAIT_MS = 5000

describe('Box Upgrade contract', () => {
    before(async () => {
        admin = await signer(0)
        nonAdmin = await signer(2)
    })

    beforeEach(async () => {
        box = await deployContractWithProxy<Box>('Box')
        upgradedListener = newEventListener(box, 'Upgraded')
    })

    describe('upgrade', () => {
        it('extension contract', async () => {
            const beforeImplementationAddress = await box.implementation()
            const beforeUpgradeAddress = box.address

            const upgradedBonds = await upgradeContract<BoxExtension>(
                'BoxExtension',
                box.address
            )

            await occurrenceAtMost(
                () => upgradedListener.events().length === 2,
                MAXIMUM_WAIT_MS
            )

            const upgradeEvents = upgradedListener.events()
            expect(upgradeEvents.length).equals(1)
            expect(upgradedBonds.address).equals(beforeUpgradeAddress)
            expect(await box.implementation()).does.not.equal(
                beforeImplementationAddress
            )
            expect(ethers.utils.isAddress(upgradeEvents[0].implementation)).is
                .true
            expect(upgradeEvents[0].implementation).equals(
                await box.implementation()
            )
        })

        it('new struct is fine', async () =>
            upgradeContract<BoxWithStruct>('BoxWithStruct', box.address))

        it('new enum is fine', async () =>
            upgradeContract<BoxWithEnum>('BoxWithEnum', box.address))

        it('no constructor', async () => {
            await expect(
                upgradeContract<BoxWithConstructor>(
                    'BoxWithConstructor',
                    box.address
                )
            ).to.be.eventually.rejectedWith(
                'Contract `BoxWithConstructor` has a constructor'
            )
        })

        it('no field with initial value', async () => {
            await expect(
                upgradeContract<BoxWithInitialValueField>(
                    'BoxWithInitialValueField',
                    box.address
                )
            ).to.be.eventually.rejectedWith(
                'Variable `_initiallyPopulatedValue` is assigned an initial value'
            )
        })

        it('no immutable field', async () => {
            await expect(
                upgradeContract<BoxWithImmutableField>(
                    'BoxWithImmutableField',
                    box.address
                )
            ).to.be.eventually.rejectedWith(
                'Variable `_neverGoingToChange` is immutable'
            )
        })

        it('no self destruct', async () => {
            await expect(
                upgradeContract<BoxWithSelfDestruct>(
                    'BoxWithSelfDestruct',
                    box.address
                )
            ).to.be.eventually.rejectedWith(
                'Use of selfdestruct is not allowed'
            )
        })

        it('only UUPS proxy', async () => {
            await expect(
                upgradeContract<BoxTransparentProxy>(
                    'BoxTransparentProxy',
                    box.address
                )
            ).to.be.eventually.rejectedWith(
                'Requested an upgrade of kind transparent but proxy is uups'
            )
        })

        it('only owner', async () => {
            expect(await box.owner()).equals(admin.address)
            await box.transferOwnership(nonAdmin.address)
            expect(await box.owner()).equals(nonAdmin.address)

            // upgrades are fixed to use the first signer (owner) account
            await expect(
                upgradeContract<Box>('Box', box.address)
            ).to.be.revertedWith(
                "reverted with reason string 'Ownable: caller is not the owner"
            )
        })
    })

    let admin: SignerWithAddress
    let nonAdmin: SignerWithAddress
    let box: Box
    let upgradedListener: EventListener<UpgradedEventObject>
})
