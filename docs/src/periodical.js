import {test, expect, is, equals} from "../_snowpack/pkg/@benchristel/taste.js";
import {spy} from "../test-utils.js";
export function createPeriodical(val) {
  const pubsub = createPubSub();
  return {
    get,
    pub: (val2) => {
      set(val2);
      pubsub.pub(val2);
    },
    sub: pubsub.sub,
    unsub: pubsub.unsub
  };
  function get() {
    return val;
  }
  function set(_val) {
    val = _val;
  }
}
test("a Periodical", {
  "contains a value"() {
    const p = createPeriodical(1);
    expect(p.get(), is, 1);
  },
  "updates the value"() {
    const p = createPeriodical(1);
    p.pub(2);
    expect(p.get(), is, 2);
  },
  "notifies a subscriber of updates"() {
    const p = createPeriodical(1);
    const subscriber = spy();
    p.sub(subscriber);
    p.pub(2);
    expect(subscriber.calls, equals, [[2]]);
    p.pub(3);
    expect(subscriber.calls, equals, [[2], [3]]);
  },
  "notifies multiple subscribers"() {
    const p = createPeriodical(1);
    const subscriber1 = spy();
    const subscriber2 = spy();
    p.sub(subscriber1);
    p.sub(subscriber2);
    p.pub(2);
    expect(subscriber1.calls, equals, [[2]]);
    expect(subscriber2.calls, equals, [[2]]);
  },
  "is up-to-date by the time subscribers are notified"() {
    const p = createPeriodical(1);
    p.sub((val) => expect(val, is, p.get()));
    p.pub(2);
  },
  "does not notify unsubscribers"() {
    const p = createPeriodical(1);
    const subscriber = spy();
    p.sub(subscriber);
    p.unsub(subscriber);
    p.pub(2);
    expect(subscriber.calls, equals, []);
  },
  "??? when you unsubscribe in a subscription callback"() {
    const p = createPeriodical(1);
    const subscriber1 = function() {
      p.unsub(subscriber2);
    };
    const subscriber2 = spy();
    p.sub(subscriber1);
    p.sub(subscriber2);
    p.pub(2);
    expect(subscriber2.calls, equals, []);
  }
});
export function createPubSub() {
  const subs = new Set();
  return {
    pub,
    sub,
    unsub
  };
  function pub(val) {
    subs.forEach((sub2) => sub2(val));
  }
  function sub(subscriber) {
    subs.add(subscriber);
  }
  function unsub(subscriber) {
    subs.delete(subscriber);
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay9zcmMvcGVyaW9kaWNhbC50cyJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBQ0E7QUFtQk8saUNBQTZCLEtBQXVCO0FBQ3pELFFBQU0sU0FBUztBQUNmLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQSxLQUFLLFVBQU87QUFBQyxVQUFJO0FBQU0sYUFBTyxJQUFJO0FBQUE7QUFBQSxJQUNsQyxLQUFLLE9BQU87QUFBQSxJQUNaLE9BQU8sT0FBTztBQUFBO0FBR2hCLGlCQUFrQjtBQUNoQixXQUFPO0FBQUE7QUFHVCxlQUFhLE1BQWU7QUFDMUIsVUFBTTtBQUFBO0FBQUE7QUFJVixLQUFLLGdCQUFnQjtBQUFBLEVBQ25CLHFCQUFxQjtBQUNuQixVQUFNLElBQUksaUJBQWlCO0FBQzNCLFdBQU8sRUFBRSxPQUFPLElBQUk7QUFBQTtBQUFBLEVBR3RCLHNCQUFzQjtBQUNwQixVQUFNLElBQUksaUJBQWlCO0FBQzNCLE1BQUUsSUFBSTtBQUNOLFdBQU8sRUFBRSxPQUFPLElBQUk7QUFBQTtBQUFBLEVBR3RCLHFDQUFxQztBQUNuQyxVQUFNLElBQUksaUJBQWlCO0FBQzNCLFVBQU0sYUFBYTtBQUNuQixNQUFFLElBQUk7QUFDTixNQUFFLElBQUk7QUFDTixXQUFPLFdBQVcsT0FBTyxRQUFRLENBQUMsQ0FBQztBQUNuQyxNQUFFLElBQUk7QUFDTixXQUFPLFdBQVcsT0FBTyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFBQTtBQUFBLEVBRzFDLGtDQUFrQztBQUNoQyxVQUFNLElBQUksaUJBQWlCO0FBQzNCLFVBQU0sY0FBYztBQUNwQixVQUFNLGNBQWM7QUFDcEIsTUFBRSxJQUFJO0FBQ04sTUFBRSxJQUFJO0FBQ04sTUFBRSxJQUFJO0FBQ04sV0FBTyxZQUFZLE9BQU8sUUFBUSxDQUFDLENBQUM7QUFDcEMsV0FBTyxZQUFZLE9BQU8sUUFBUSxDQUFDLENBQUM7QUFBQTtBQUFBLEVBR3RDLHVEQUF1RDtBQUNyRCxVQUFNLElBQUksaUJBQWlCO0FBQzNCLE1BQUUsSUFBSSxTQUFPLE9BQU8sS0FBSyxJQUFJLEVBQUU7QUFDL0IsTUFBRSxJQUFJO0FBQUE7QUFBQSxFQUdSLGtDQUFrQztBQUNoQyxVQUFNLElBQUksaUJBQWlCO0FBQzNCLFVBQU0sYUFBYTtBQUNuQixNQUFFLElBQUk7QUFDTixNQUFFLE1BQU07QUFDUixNQUFFLElBQUk7QUFDTixXQUFPLFdBQVcsT0FBTyxRQUFRO0FBQUE7QUFBQSxFQUduQyx3REFBd0Q7QUFFdEQsVUFBTSxJQUFJLGlCQUFpQjtBQUMzQixVQUFNLGNBQWMsV0FBVztBQUM3QixRQUFFLE1BQU07QUFBQTtBQUVWLFVBQU0sY0FBYztBQUNwQixNQUFFLElBQUk7QUFDTixNQUFFLElBQUk7QUFDTixNQUFFLElBQUk7QUFDTixXQUFPLFlBQVksT0FBTyxRQUFRO0FBQUE7QUFBQTtBQUkvQiwrQkFBNEM7QUFDakQsUUFBTSxPQUFPLElBQUk7QUFDakIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBO0FBR0YsZUFBYSxLQUFjO0FBQ3pCLFNBQUssUUFBUSxVQUFPLEtBQUk7QUFBQTtBQUcxQixlQUFhLFlBQStCO0FBQzFDLFNBQUssSUFBSTtBQUFBO0FBR1gsaUJBQWUsWUFBK0I7QUFDNUMsU0FBSyxPQUFPO0FBQUE7QUFBQTsiLAogICJuYW1lcyI6IFtdCn0K
