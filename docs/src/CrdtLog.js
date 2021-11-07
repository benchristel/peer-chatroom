import {test, expect, equals} from "../_snowpack/pkg/@benchristel/taste.js";
test("CrdtLog.merge", {
  "returns an empty log given two empty logs"() {
    expect(merge(empty(), empty()), equals, empty());
  },
  "keeps items from the first log"() {
    const log1 = append("me", "hello", empty());
    const log2 = empty();
    expect(toArray(merge(log1, log2)), equals, ["hello"]);
  },
  "keeps items from the second log"() {
    const log1 = empty();
    const log2 = append("me", "hello", empty());
    expect(toArray(merge(log1, log2)), equals, ["hello"]);
  },
  "keeps items from both logs, ordering by agent ID in case of an index collision"() {
    const log1 = append("me", "hello", empty());
    const log2 = append("you", "goodbye", empty());
    expect(toArray(merge(log1, log2)), equals, ["hello", "goodbye"]);
    expect(merge(log2, log1), equals, merge(log1, log2));
  },
  "after merging, appends new items at the end"() {
    const log1 = empty();
    const log2 = append("you", "hi", empty());
    expect(toArray(append("me", "yo", merge(log1, log2))), equals, ["hi", "yo"]);
  }
});
test("CrdtLog.append", {
  "appends items without mutating the original log"() {
    const originalLog = empty();
    expect(toArray(append("", "hi", originalLog)), equals, ["hi"]);
    expect(originalLog, equals, empty());
  },
  "keeps previously appended items"() {
    let log = empty();
    log = append("", "foo", log);
    log = append("", "bar", log);
    expect(toArray(log), equals, ["foo", "bar"]);
  }
});
export function empty() {
  return {
    nextIndex: 0,
    entries: {}
  };
}
export function merge(a, b) {
  const nextIndex = Math.max(a.nextIndex, b.nextIndex);
  const entries = {...a.entries, ...b.entries};
  return {nextIndex, entries};
}
export function toArray(log) {
  return Object.entries(log.entries).sort(([a], [b]) => {
    const aIndex = Number(a.split(":")[0]);
    const bIndex = Number(b.split(":")[0]);
    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    } else {
      return a > b ? 1 : -1;
    }
  }).map(([key, value]) => value);
}
export function append(agentId, item, log) {
  return {
    nextIndex: log.nextIndex + 1,
    entries: {
      ...log.entries,
      [log.nextIndex + ":" + agentId]: item
    }
  };
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay9zcmMvQ3JkdExvZy50cyJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBU0EsS0FBSyxpQkFBaUI7QUFBQSxFQUNwQiw4Q0FBOEM7QUFDNUMsV0FBTyxNQUFNLFNBQVMsVUFBVSxRQUFRO0FBQUE7QUFBQSxFQUcxQyxtQ0FBbUM7QUFDakMsVUFBTSxPQUFPLE9BQU8sTUFBTSxTQUFTO0FBQ25DLFVBQU0sT0FBTztBQUNiLFdBQU8sUUFBUSxNQUFNLE1BQU0sUUFBUSxRQUFRLENBQUM7QUFBQTtBQUFBLEVBRzlDLG9DQUFvQztBQUNsQyxVQUFNLE9BQU87QUFDYixVQUFNLE9BQU8sT0FBTyxNQUFNLFNBQVM7QUFDbkMsV0FBTyxRQUFRLE1BQU0sTUFBTSxRQUFRLFFBQVEsQ0FBQztBQUFBO0FBQUEsRUFHOUMsbUZBQW1GO0FBQ2pGLFVBQU0sT0FBTyxPQUFPLE1BQU0sU0FBUztBQUNuQyxVQUFNLE9BQU8sT0FBTyxPQUFPLFdBQVc7QUFDdEMsV0FBTyxRQUFRLE1BQU0sTUFBTSxRQUFRLFFBQVEsQ0FBQyxTQUFTO0FBQ3JELFdBQU8sTUFBTSxNQUFNLE9BQU8sUUFBUSxNQUFNLE1BQU07QUFBQTtBQUFBLEVBR2hELGdEQUFnRDtBQUM5QyxVQUFNLE9BQU87QUFDYixVQUFNLE9BQU8sT0FBTyxPQUFPLE1BQU07QUFDakMsV0FDRSxRQUNFLE9BQU8sTUFBTSxNQUFNLE1BQU0sTUFBTSxTQUVqQyxRQUNBLENBQUMsTUFBTTtBQUFBO0FBQUE7QUFLYixLQUFLLGtCQUFrQjtBQUFBLEVBQ3JCLG9EQUFvRDtBQUNsRCxVQUFNLGNBQWM7QUFDcEIsV0FBTyxRQUFRLE9BQU8sSUFBSSxNQUFNLGVBQWUsUUFBUSxDQUFDO0FBQ3hELFdBQU8sYUFBYSxRQUFRO0FBQUE7QUFBQSxFQUc5QixvQ0FBb0M7QUFDbEMsUUFBSSxNQUFNO0FBQ1YsVUFBTSxPQUFPLElBQUksT0FBTztBQUN4QixVQUFNLE9BQU8sSUFBSSxPQUFPO0FBQ3hCLFdBQU8sUUFBUSxNQUFNLFFBQVEsQ0FBQyxPQUFPO0FBQUE7QUFBQTtBQUlsQyx3QkFBZ0M7QUFDckMsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsU0FBUztBQUFBO0FBQUE7QUFJTixzQkFBa0IsR0FBZSxHQUEyQjtBQUNqRSxRQUFNLFlBQVksS0FBSyxJQUFJLEVBQUUsV0FBVyxFQUFFO0FBQzFDLFFBQU0sVUFBVSxJQUFJLEVBQUUsWUFBWSxFQUFFO0FBQ3BDLFNBQU8sQ0FBQyxXQUFXO0FBQUE7QUFHZCx3QkFBb0IsS0FBMkI7QUFDcEQsU0FBTyxPQUFPLFFBQVEsSUFBSSxTQUN2QixLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTztBQUNsQixVQUFNLFNBQVMsT0FBTyxFQUFFLE1BQU0sS0FBSztBQUNuQyxVQUFNLFNBQVMsT0FBTyxFQUFFLE1BQU0sS0FBSztBQUNuQyxRQUFJLFdBQVcsUUFBUTtBQUNyQixhQUFPLFNBQVM7QUFBQSxXQUNYO0FBQ0wsYUFBTyxJQUFJLElBQUksSUFBSTtBQUFBO0FBQUEsS0FHdEIsSUFBSSxDQUFDLENBQUMsS0FBSyxXQUFXO0FBQUE7QUFHcEIsdUJBQW1CLFNBQWlCLE1BQVMsS0FBNkI7QUFDL0UsU0FBTztBQUFBLElBQ0wsV0FBVyxJQUFJLFlBQVk7QUFBQSxJQUMzQixTQUFTO0FBQUEsU0FDSixJQUFJO0FBQUEsT0FDTixJQUFJLFlBQVksTUFBTSxVQUFVO0FBQUE7QUFBQTtBQUFBOyIsCiAgIm5hbWVzIjogW10KfQo=
