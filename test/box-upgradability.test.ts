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
import {
    UpgradedEventArgs,
    upgradedEvent
} from './contracts/upgradable/upgradable-events'
import {occurrenceAtMost} from './framework/time'
import {EventListener} from './framework/event-listener'
import {ethers} from 'ethers'
import {
    Box,
    BoxExtension,
    BoxWithConstructor,
    BoxWithEnum,
    BoxWithImmutableField,
    BoxWithInitialValueField,
    BoxWithSelfDestruct,
    BoxWithStruct
} from '../typechain'

// Wires Chai with Waffle and Promises
chai.use(solidity)
chai.use(chaiAsPromised)

const MAXIMUM_WAIT_MS = 5000

describe('BondFactory contract', () => {
    before(async () => {
        admin = await signer(0)
        treasury = (await signer(1)).address
        nonAdmin = await signer(2)
    })

    beforeEach(async () => {
        bonds = await deployContractWithProxy<Box>('Box')
        upgradedListener = new EventListener<UpgradedEventArgs>(
            bonds,
            'Upgraded',
            (event) => upgradedEvent(event)
        )
    })

    describe('upgrade', () => {
        it('extension contract', async () => {
            const beforeUpgradeAddress = bonds.address

            const upgradedBonds = await upgradeContract<BoxExtension>(
                'BoxExtension',
                bonds.address
            )

            await occurrenceAtMost(
                () => upgradedListener.events().length === 2,
                MAXIMUM_WAIT_MS
            )

            const upgradeEvents = upgradedListener.events()
            expect(upgradeEvents.length).equals(2)
            expect(upgradedBonds.address).equals(beforeUpgradeAddress)
            expect(ethers.utils.isAddress(upgradeEvents[0].implementation)).is
                .true
            expect(ethers.utils.isAddress(upgradeEvents[1].implementation)).is
                .true
            expect(upgradeEvents[0].implementation).does.not.equal(
                upgradeEvents[1].implementation
            )
        })

        it('new struct is fine', async () =>
            upgradeContract<BoxWithStruct>('BoxWithStruct', bonds.address))

        it('new enum is fine', async () =>
            upgradeContract<BoxWithEnum>('BoxWithEnum', bonds.address))

        it('no constructor', async () => {
            await expect(
                upgradeContract<BoxWithConstructor>(
                    'BoxWithConstructor',
                    bonds.address
                )
            ).to.be.eventually.rejectedWith(
                'Contract `BoxWithConstructor` has a constructor'
            )
        })

        it('no field with initial value', async () => {
            await expect(
                upgradeContract<BoxWithInitialValueField>(
                    'BoxWithInitialValueField',
                    bonds.address
                )
            ).to.be.eventually.rejectedWith(
                'Variable `_initiallyPopulatedValue` is assigned an initial value'
            )
        })

        it('no immutable field', async () => {
            await expect(
                upgradeContract<BoxWithImmutableField>(
                    'BoxWithImmutableField',
                    bonds.address
                )
            ).to.be.eventually.rejectedWith(
                'Variable `_neverGoingToChange` is immutable'
            )
        })

        it('no self destruct', async () => {
            await expect(
                upgradeContract<BoxWithSelfDestruct>(
                    'BoxWithSelfDestruct',
                    bonds.address
                )
            ).to.be.eventually.rejectedWith(
                'Use of selfdestruct is not allowed'
            )
        })

        it('only owner', async () => {
            expect(await bonds.owner()).equals(admin.address)
            await bonds.transferOwnership(nonAdmin.address)
            expect(await bonds.owner()).equals(nonAdmin.address)

            // upgrades are fixed to use the first signer (owner) account
            await expect(
                upgradeContract<Box>('Box', bonds.address)
            ).to.be.revertedWith(
                "reverted with reason string 'Ownable: caller is not the owner"
            )
        })
    })

    let admin: SignerWithAddress
    let treasury: string
    let nonAdmin: SignerWithAddress
    let bonds: Box
    let upgradedListener: EventListener<UpgradedEventArgs>
})
