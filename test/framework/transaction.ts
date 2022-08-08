import {expect} from 'chai'
import {ContractTransaction} from 'ethers'
import {ContractReceipt} from '@ethersproject/contracts/src.ts/index'

export type ContractReceiptSource =
    | ContractReceipt
    | Promise<ContractReceipt>
    | ContractTransaction
    | Promise<ContractTransaction>

export async function contractReceiptOf(
    av: ContractReceiptSource,
    confirmations?: number
): Promise<ContractReceipt> {
    const v = await av
    return 'gasUsed' in v ? v : v.wait(confirmations)
}

/**
 * The expectation is successful transaction (with receipt).
 *
 * @param transaction waits for the receipt, verifying it is a success.
 */
export async function successfulTransaction(
    transaction: ContractReceiptSource
): Promise<ContractReceipt> {
    const receipt = await contractReceiptOf(transaction, 1)

    // Transaction status code https://eips.ethereum.org/EIPS/eip-1066
    const SUCCESS = 1

    expect(receipt).is.not.undefined
    expect(receipt.status).equals(SUCCESS)

    return receipt
}
