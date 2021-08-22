import {processArgsToConfig} from './config'
import {createLinkNode} from './forward'
import {sample} from './sample'
import {createEvent} from './createUnit'
import {combine} from './combine'
import {step} from './typedef'
import {callStack} from './caller'
import {assertNodeSet, is, isFunction} from './is'
import {createNode} from './createNode'
import {throwError} from './throw'
import {merge} from './merge'

export function guard(...args: any[]) {
  const meta: Record<string, any> = {op: 'guard'}
  let rawName = 'guard'
  let [[source, config], metadata] = processArgsToConfig(args)
  if (metadata) {
    meta.config = metadata
    if (metadata.name) rawName = metadata.name
  }
  if (!config) {
    config = source
    source = config.source
  }
  let {filter, greedy, clock, name = rawName} = config
  const target = config.target || createEvent(name, meta.config)
  const filterIsUnit = is.unit(filter)
  let needToCombine = true
  if (source === undefined) {
    assertNodeSet(clock, 'guard', 'clock')
    if (Array.isArray(clock)) {
      clock = merge(clock)
    }
    source = clock
    needToCombine = false
  }
  if (needToCombine && !is.unit(source)) source = combine(source)
  if (clock) {
    assertNodeSet(clock, 'guard', 'clock')
    source = sample({
      source,
      clock,
      greedy,
      fn: filterIsUnit ? null : (source: any, clock: any) => ({source, clock}),
    })
  }
  assertNodeSet(target, 'guard', 'target')
  if (filterIsUnit) {
    sample({
      source: filter,
      clock: source,
      target: createNode({
        node: [
          step.compute({
            filter: true,
            safe: true,
            fn: ({guard}) => guard,
          }),
          step.compute({
            safe: true,
            fn: ({data}) => data,
          }),
        ],
        child: target,
        meta,
        family: {
          owners: [source, filter, target, ...[].concat(clock ? clock : [])],
          links: target,
        },
        regional: true,
      }),
      fn: (guard: any, data: any) => ({guard, data}),
      greedy,
      name,
    })
  } else {
    if (!isFunction(filter)) throwError('`filter` should be function or unit')
    createLinkNode(source, target, {
      scope: {fn: filter},
      node: clock
        ? [
            step.filter({
              fn: ({source, clock}, {fn}) => fn(source, clock),
            }),
            step.compute({
              safe: true,
              fn: ({source}) => source,
            }),
          ]
        : [step.filter({fn: callStack})],
      meta,
    })
  }
  return target
}
