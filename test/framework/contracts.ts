import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {ethers, upgrades} from 'hardhat'
import {expect} from 'chai'
import {ContractReceipt, ContractTransaction} from 'ethers'

import {wrapImportedFactories} from '@windranger-io/windranger-tools-ethers/dist/tools/contract-wrappers'
import * as types from '../../typechain-types'

const typedFactories = wrapImportedFactories(types, signer(0))

/**
 * Deploys a contract, that may or may not have constructor parameters.
 *
 * @param name the case sensitive name of the contract in the Solidity file.
 */
export const deployContract = typedFactories.deploy.bind(typedFactories)

/**
 * Deploys an admin proxy with the contract as the implementation behind.
 * The contract may or may not have constructor parameters.
 *
 * @param name the case sensitive name of the contract in the Solidity file.
 */
export const deployContractWithProxy = typedFactories.deployWithDelegate(
    async (factory, deployArgs) => {
        const contract = await upgrades.deployProxy(factory, [...deployArgs], {
            kind: 'uups'
        })
        return contract.deployed()
    }
)

/**
 * Upgrades an implementation contract that has a proxy contract in front.
 *
 * @param name the case sensitive name of the contract in the Solidity file.
 * @param address existing address of a proxy with the implementation behind.
 */
export const upgradeContract = typedFactories.attachWithDelegate(
    async (factory, address) => {
        const contract = await upgrades.upgradeProxy(address, factory)
        return contract.deployed()
    }
)

/**
 * Executes the transaction and waits until it has processed before returning.
 */
export async function execute(
    transaction: Promise<ContractTransaction>
): Promise<ContractReceipt> {
    return (await transaction).wait()
}

/**
 * Retrieves the signer found at the given index in the HardHat config,
 * failing when not present.
 */
export async function signer(index: number): Promise<SignerWithAddress> {
    const signers = await ethers.getSigners()
    expect(signers.length).is.greaterThan(index)
    return signers[index]
}
