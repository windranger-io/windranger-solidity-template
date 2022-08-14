import {Table} from 'console-table-printer'
import {extendConfig, task, types} from 'hardhat/config'
import {
    HardhatConfig,
    HardhatRuntimeEnvironment,
    SolcConfig
} from 'hardhat/types'
import chalk from 'chalk'

import fs from 'fs'
import path from 'path'

const MAX_CONTRACT_SIZE = 24576 // applied to color contract size as green / yellow / red

/* eslint-disable no-lone-blocks */

extendConfig((config: HardhatConfig) => {
    for (const compiler of config.solidity.compilers) {
        addOutputSelections(compiler, [
            'evm.bytecode.object',
            'evm.bytecode.sourceMap',
            'evm.deployedBytecode.object',
            'evm.deployedBytecode.sourceMap'
        ])
    }
})

task(
    'contract-sizes',
    'Prints size of contracts, including contribution of source files into bytecode of a contract'
)
    .addFlag(
        'details',
        'Print contribution of each source files into bytecode of a contract'
    )
    .addFlag(
        'diff',
        'Print size difference with the previous run with this flag'
    )
    .addOptionalParam(
        'size',
        'Filter by contract size (20 000 by default)',
        0,
        types.int
    )
    .addOptionalVariadicPositionalParam(
        'contracts',
        'Contracts to be printed, names or FQNs'
    )
    .setAction(async ({details: verbose, diff, size, contracts}, hre) => {
        const c = (contracts ?? []) as string[]
        const mappings = await extractBytecodeMappings(hre, c)
        if (mappings.length === 0) {
            // eslint-disable-next-line no-console
            console.log('No contracts found')
        }

        // eslint-disable-next-line no-undefined
        const prevSizes = diff ? await loadPrevSizes(hre) : undefined
        if (diff) {
            await savePrevSizes(hre, mappings)
        }

        mappings.sort((a, b) =>
            a.codeSize === b.codeSize
                ? a.name.localeCompare(b.name)
                : a.codeSize - b.codeSize
        )

        const maxSize = (size ?? 0) as number
        const p = tabulateBytecodeMappings(
            mappings,
            maxSize,
            Boolean(verbose),
            prevSizes
        )
        if (p.table.rows.length > 0) {
            p.printTable()
        } else {
            // eslint-disable-next-line no-console
            console.log(`There are no contracts exceeding ${maxSize} bytes`)
        }
    })

function addOutputSelections(compiler: SolcConfig, selections: string[]) {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    compiler.settings ??= {}
    compiler.settings.outputSelection ??= {}
    compiler.settings.outputSelection['*'] ??= {}
    compiler.settings.outputSelection['*']['*'] ??= []
    const outputSelection = compiler.settings.outputSelection['*'][
        '*'
    ] as string[]
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */

    for (const s of selections) {
        if (!outputSelection.includes(s)) {
            outputSelection.push(s)
        }
    }
}

interface ContractCodeSource {
    fileName: string
    codeSize: number
    initSize: number
}

interface ContractCodeMapping {
    name: string
    codeSize: number
    initSize: number
    sources: ContractCodeSource[]
}

interface ArtifactJsonABI {
    output: {
        contracts: {
            [key: string]: {
                [key: string]: ArtifactJsonContract
            }
        }
        sources: {
            id: number
        }[]
    }
}

interface ArtifactJsonContract {
    evm: ArtifactJsonContractEVM
}

interface ArtifactJsonContractEVM {
    bytecode: ArtifactJsonContractEVMBytecode
    deployedBytecode: ArtifactJsonContractEVMBytecode
}

interface ArtifactJsonContractEVMBytecode {
    generatedSources: {
        id: number
        name: string
    }[]
    object: string
    sourceMap: string
}

interface ArtifactDebugFile {
    buildInfo: string
}

const noSourceId = -1
const metadataId = -2
const unknownCodeId = -3

async function extractBytecodeMappings(
    env: HardhatRuntimeEnvironment,
    names: string[]
): Promise<ContractCodeMapping[]> {
    const contracts: {
        sourceName: string
        contractName: string
        buildInfoFile: string
    }[] = []

    const filters: Set<string> = new Set()
    ;(names ?? []).forEach((name) => filters.add(name))

    const buildInfoPaths = await env.artifacts.getBuildInfoPaths()

    {
        const fullyQualifiedNames =
            await env.artifacts.getAllFullyQualifiedNames()
        for (const fullName of fullyQualifiedNames) {
            const {sourceName, contractName} = await env.artifacts.readArtifact(
                fullName
            )
            if (
                filters.size === 0 ||
                filters.has(contractName) ||
                filters.has(fullName)
            ) {
                let buildInfoFile = ''

                if (buildInfoPaths.length > 1) {
                    const dbgFileName = _getDebugFilePath(
                        env.artifacts.formArtifactPathFromFullyQualifiedName(
                            fullName
                        )
                    )
                    const dbgFile = JSON.parse(
                        fs.readFileSync(dbgFileName).toString()
                    ) as ArtifactDebugFile
                    buildInfoFile = path.basename(dbgFile.buildInfo)
                }
                contracts.push({sourceName, contractName, buildInfoFile})
            }
        }

        if (!contracts) {
            return []
        }
    }

    const contractLayouts: ContractCodeMapping[] = []

    for (const buildInfoPath of buildInfoPaths) {
        const artifact = fs.readFileSync(buildInfoPath)
        const artifactJsonABI = JSON.parse(
            artifact.toString()
        ) as ArtifactJsonABI

        const sourceFiles: Map<number, string> = new Map()
        Object.entries(artifactJsonABI.output.sources).forEach(
            ([key, {id}]) => {
                sourceFiles.set(id, key)
            }
        )
        sourceFiles.set(noSourceId, '## non-mapped bytecode')
        sourceFiles.set(metadataId, '## metadata hash')
        sourceFiles.set(unknownCodeId, '## non-code bytes')

        for (const {sourceName, contractName, buildInfoFile} of contracts) {
            if (
                buildInfoFile &&
                buildInfoFile !== path.basename(buildInfoPath)
            ) {
                // eslint-disable-next-line no-continue
                continue
            }

            const contractInfo =
                artifactJsonABI.output.contracts[sourceName][contractName]
            if (!contractInfo) {
                // eslint-disable-next-line no-console
                console.error(
                    `Build info was not found in ${buildInfoFile} for ${sourceName}:${contractName}`
                )
                // eslint-disable-next-line no-continue
                continue
            }
            const evm = contractInfo.evm

            const initSizes: Map<number, number> = new Map()
            const codeSizes: Map<number, number> = new Map()

            const contractLayout: ContractCodeMapping = {
                name: contractName,
                initSize: countBytes(
                    evm.bytecode.sourceMap,
                    evm.bytecode.object,
                    initSizes,
                    evm.deployedBytecode.object.length
                ),
                codeSize: countBytes(
                    evm.deployedBytecode.sourceMap,
                    evm.deployedBytecode.object,
                    codeSizes,
                    0,
                    true
                ),
                sources: []
            }

            const generatedSources: Map<number, string> = new Map()
            evm.bytecode.generatedSources.forEach((entry) =>
                generatedSources.set(entry.id, `## compiler ${entry.name}`)
            )
            evm.deployedBytecode.generatedSources.forEach((entry) =>
                generatedSources.set(entry.id, `## compiler ${entry.name}`)
            )

            const sources: Map<number, ContractCodeSource> = new Map()
            const getSourceEntry = (id: number): ContractCodeSource => {
                {
                    const entry = sources.get(id)
                    if (entry) {
                        return entry
                    }
                }
                const fileName =
                    sourceFiles.get(id) ??
                    generatedSources.get(id) ??
                    `<unknown:${id}>`
                const entry: ContractCodeSource = {
                    fileName,
                    codeSize: 0,
                    initSize: 0
                }
                sources.set(id, entry)
                return entry
            }

            initSizes.forEach((value, key) => {
                const entry = getSourceEntry(key)
                entry.initSize += value
            })

            codeSizes.forEach((value, key) => {
                const entry = getSourceEntry(key)
                entry.codeSize += value
            })

            sources.forEach((source) => contractLayout.sources.push(source))
            contractLayout.sources.sort((a, b) => a.codeSize - b.codeSize)

            contractLayouts.push(contractLayout)
        }
    }

    return contractLayouts
}

function countBytes(
    sourceMap: string,
    bytecode: string,
    sizes: Map<number, number>,
    tailLen: number,
    allowMeta?: boolean
): number {
    let decodePos = 0
    let sourceId = noSourceId

    const addSize = (id: number, size: number) => {
        if (size > 0) {
            sizes.set(id, size + (sizes.get(id) ?? 0))
        }
    }

    if (sourceMap) {
        for (const mapping of sourceMap.split(';')) {
            const components = mapping.split(':')
            if (components.length >= 3 && components[2]) {
                sourceId = parseInt(components[2], 10)
            }
            let n = 1
            // eslint-disable-next-line default-case
            switch (bytecode[decodePos]) {
                case '7': // PUSH17 - PUSH32
                    n += 16
                // eslint-disable-next-line no-fallthrough
                case '6': // PUSH01 - PUSH16
                    n += parseInt(bytecode[decodePos + 1], 16)
                    n += 1
            }
            addSize(sourceId, n)
            decodePos += n * 2
        }
    }

    let unknown = bytecode.length - decodePos
    if (
        unknown > tailLen &&
        unknown >= 2 &&
        bytecode.substring(decodePos, decodePos + 2).toUpperCase() === 'FE'
    ) {
        // terminating *ASSERT op
        addSize(sourceId, 1)
        unknown -= 2
    }
    if (unknown > tailLen) {
        unknown -= tailLen

        if (allowMeta && unknown >= 4) {
            const metadataLen =
                parseInt(bytecode.substring(bytecode.length - 4), 16) + 2
            if (metadataLen * 2 > unknown) {
                throw Error(
                    `Inconsistent metadata size: ${unknown} < ${
                        metadataLen * 2
                    }`
                )
            }
            unknown -= metadataLen * 2
            addSize(metadataId, metadataLen)
        }
        if (unknown > 0) {
            addSize(unknownCodeId, unknown / 2)
        }
    } else if (unknown < tailLen) {
        throw Error(`Inconsistent bytecode size: ${unknown} < ${tailLen}`)
    }

    return (bytecode.length - tailLen) / 2
}

function _getDebugFilePath(artifactPath: string): string {
    return artifactPath.replace(/\.json$/, '.dbg.json')
}

const colorSize = (code: number): string => {
    const v = code.toLocaleString()
    if (code > MAX_CONTRACT_SIZE) {
        return chalk.red(v)
    } else if (code > MAX_CONTRACT_SIZE * 0.85) {
        return chalk.yellow(v)
    }
    return v
}

function tabulateBytecodeMappings(
    contracts: ContractCodeMapping[],
    maxSize: number,
    verbose: boolean,
    prev?: StoredCodeMappings
): Table {
    const codeColumnDelta = '±code'
    const codeColumnPct = 'code%'

    const columns = [{name: 'contract', alignment: 'left'}]
    if (verbose) {
        columns.push(
            {name: 'source', alignment: 'left'},
            {name: codeColumnPct, alignment: 'right'}
        )
    }
    columns.push({name: 'code', alignment: 'right'})
    if (prev) {
        columns.push({name: codeColumnDelta, alignment: 'right'})
    }
    columns.push({name: 'init', alignment: 'right'})

    interface Row {
        contract: string
        source?: string
        code: string
        [codeColumnPct]?: string
        [codeColumnDelta]?: string
        init: string
    }

    const p = new Table({columns})

    for (const c of contracts) {
        if (maxSize > c.codeSize + c.initSize) {
            // eslint-disable-next-line no-continue
            continue
        }

        if (verbose && p.table.rows.length > 0) {
            p.addRow({})
        }

        const addDelta = (v: Row, code: number, codePrev?: number): Row => {
            // eslint-disable-next-line no-undefined
            if (codePrev === undefined) {
                return v
            }
            const d = code - codePrev
            if (d === 0) {
                return v
            }

            v[codeColumnDelta] =
                d > 0
                    ? chalk.red(`+${d.toLocaleString()}`)
                    : chalk.green(`-${(-d).toLocaleString()}`)

            return v
        }

        if (verbose) {
            for (const source of c.sources) {
                const srcName =
                    source.fileName[0] === '#'
                        ? chalk.gray(chalk.italic(source.fileName))
                        : source.fileName

                const pct = `${Math.round(
                    (source.codeSize * 100) / c.codeSize
                )}%`

                const row = {
                    contract: c.name,
                    source: srcName,
                    code: source.codeSize.toLocaleString(),
                    [codeColumnPct]: pct,
                    init: source.initSize.toLocaleString()
                }

                const prevSize =
                    prev?.[c.name]?.sources[source.fileName]?.codeSize

                p.addRow(addDelta(row, source.codeSize, prevSize))
            }
        }

        const row: Row = {
            contract: c.name,
            code: colorSize(c.codeSize),
            init: c.initSize.toLocaleString()
        }
        if (verbose) {
            row.source = c.sources.length > 0 ? chalk.bold('== Total') : ''
            row.code = chalk.bold(row.code)
            row.init = chalk.bold(row.init)
        }

        const prevSize = prev?.[c.name]?.codeSize
        p.addRow(addDelta(row, c.codeSize, prevSize))
    }

    return p
}

interface StoredCodeMappings {
    [name: string]: {
        codeSize: number
        initSize: number
        sources: {
            [name: string]: {
                codeSize: number
                initSize: number
            }
        }
    }
}

function _outputPath(hre: HardhatRuntimeEnvironment): string {
    return path.resolve(
        hre.config.paths.cache,
        '.wr_contract_sizer_output.json'
    )
}

async function loadPrevSizes(
    hre: HardhatRuntimeEnvironment
): Promise<StoredCodeMappings> {
    const outputPath = _outputPath(hre)

    if (fs.existsSync(outputPath)) {
        const prev = await fs.promises.readFile(outputPath)

        return JSON.parse(prev.toString()) as StoredCodeMappings
    }

    return {}
}

async function savePrevSizes(
    hre: HardhatRuntimeEnvironment,
    mappings: ContractCodeMapping[]
) {
    const outputPath = _outputPath(hre)

    const result: StoredCodeMappings = {}
    mappings.forEach((m) => {
        if (m.sources.length === 0) {
            return
        }

        const sources: Record<
            string,
            {
                codeSize: number
                initSize: number
            }
        > = {}

        m.sources.forEach(
            (s) =>
                (sources[s.fileName] = {
                    codeSize: s.codeSize,
                    initSize: s.initSize
                })
        )

        result[m.name] = {
            codeSize: m.codeSize,
            initSize: m.initSize,
            sources
        }
    })

    await fs.promises.writeFile(outputPath, JSON.stringify(result), {flag: 'w'})
}
