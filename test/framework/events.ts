import {BaseContract} from 'ethers'
import {wrapEventType} from '@windranger-io/windranger-tools-ethers'
import {TypedEvent, TypedEventFilter} from '../../typechain-types/common'

/*
 * This method MUST be local to a project as it must take project's local TypedEvent and TypedEventFilter
 * Use of compatible substitutes will lead to loss of typing info
 */
export const eventOf = <
    C extends BaseContract,
    N extends keyof C['filters'] & string,
    E extends ReturnType<C['filters'][N]> extends TypedEventFilter<
        infer R extends TypedEvent
    >
        ? R
        : never
>(
    emitter: C,
    name: N
) =>
    wrapEventType<
        E extends TypedEvent<infer A, object> ? A : never,
        E extends TypedEvent<unknown[], infer O extends object> ? O : never
    >(name, emitter)
