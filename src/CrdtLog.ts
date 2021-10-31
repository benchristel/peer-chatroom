import {test, expect, equals} from "@benchristel/taste"

export type CrdtLog<T> = {
  nextIndex: number,
  entries: {
    [position: string]: T,
  },
}

test("CrdtLog.merge", {
  "returns an empty log given two empty logs"() {
    expect(merge(empty(), empty()), equals, empty())
  },

  "keeps items from the first log"() {
    const log1 = append("me", "hello", empty())
    const log2 = empty()
    expect(toArray(merge(log1, log2)), equals, ["hello"])
  },

  "keeps items from the second log"() {
    const log1 = empty()
    const log2 = append("me", "hello", empty())
    expect(toArray(merge(log1, log2)), equals, ["hello"])
  },

  "keeps items from both logs, ordering by agent ID in case of an index collision"() {
    const log1 = append("me", "hello", empty())
    const log2 = append("you", "goodbye", empty())
    expect(toArray(merge(log1, log2)), equals, ["hello", "goodbye"])
    expect(merge(log2, log1), equals, merge(log1, log2))
  },

  "after merging, appends new items at the end"() {
    const log1 = empty()
    const log2 = append("you", "hi", empty())
    expect(
      toArray(
        append("me", "yo", merge(log1, log2)),
      ),
      equals,
      ["hi", "yo"],
    )
  }
})

export function empty<T>(): CrdtLog<T> {
  return {
    nextIndex: 0,
    entries: {},
  }
}

export function merge<T>(a: CrdtLog<T>, b: CrdtLog<T>): CrdtLog<T> {
  const nextIndex = Math.max(a.nextIndex, b.nextIndex)
  const entries = {...a.entries, ...b.entries}
  return {nextIndex, entries}
}

export function toArray<T>(log: CrdtLog<T>): Array<T> {
  return Object.entries(log.entries)
    .sort(([a], [b]) => {
      const aIndex = Number(a.split(":")[0])
      const bIndex = Number(b.split(":")[0])
      if (aIndex !== bIndex) {
        return aIndex - bIndex
      } else {
        return a > b ? 1 : -1
      }
    })
    .map(([key, value]) => value)
}

export function append<T>(agentId: string, item: T, log: CrdtLog<T>): CrdtLog<T> {
  return {
    nextIndex: log.nextIndex + 1,
    entries: {
      ...log.entries,
      [log.nextIndex + ":" + agentId]: item,
    },
  }
}
