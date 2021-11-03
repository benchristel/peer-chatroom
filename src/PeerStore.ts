import type {Sub, Get} from "./periodical"
import {createPeriodical, createPubSub} from "./periodical"
import {test, expect, is, equals} from "@benchristel/taste"
import {spy} from "../test-utils"

export type PeerStore<State> = {
  apply(update: State): void,
  state: Sub<State> & Get<State>,
  networkStatus: Sub<NetworkStatus> & Get<NetworkStatus>,
}

export type NetworkStatus =
  | "pending"
  | "connected"
  | "reconnecting"

export type PeerStoreConfig<State> = {
  load(): Promise<State>,
  save(state: State): unknown,
  merge(a: State, b: State): State,
  send(state: State): unknown,
  remoteUpdates: Sub<State>,
  networkStatus: Sub<NetworkStatus> & Get<NetworkStatus>,
}

export async function createPeerStore<State>(
  config: Readonly<PeerStoreConfig<State>>,
): Promise<PeerStore<State>> {
  let state = await config.load()
  const statePeriodical = createPeriodical(state)
  // TODO: memory leak! add a destroy method that unsubs
  config.networkStatus.sub(sendStateIfOnline)
  config.remoteUpdates.sub(updateStateLocally)
  return {
    apply,
    state: statePeriodical,
    networkStatus: config.networkStatus,
  }

  function apply(update: State) {
    updateStateLocally(update)
    sendStateIfOnline()
  }

  function isOnline() {
    return config.networkStatus.get() === "connected"
  }

  function updateStateLocally(update: State) {
    state = config.merge(state, update)
    config.save(state)
    statePeriodical.pub(state)
  }

  function sendStateIfOnline() {
    if (isOnline()) config.send(state)
  }
}

{ // tests
  async function setUpStore() {
    const save = spy()
    const send = spy()
    const remoteUpdates = createPubSub<number>()
    const networkStatus = createPeriodical<NetworkStatus>("pending")
    const store = await createPeerStore<number>({
      load: () => Promise.resolve(0),
      merge: (a, b) => a + b,
      save,
      send,
      remoteUpdates,
      networkStatus,
    })
    return {store, save, send, remoteUpdates, networkStatus}
  }

  test("a PeerStore", {
    async "loads its state from the underlying storage"() {
      const {store} = await setUpStore()
      expect(store.state.get(), is, 0)
    },

    async "updates its network status in reponse to changes"() {
      const {store, networkStatus} = await setUpStore()
      expect(store.networkStatus.get(), is, "pending")
      networkStatus.pub("connected")
      expect(store.networkStatus.get(), is, "connected")
    },

    async "notifies subscribers of changes to network status"() {
      const {store, networkStatus} = await setUpStore()
      const networkStatusSpy = spy()
      store.networkStatus.sub(networkStatusSpy)
      expect(networkStatusSpy.calls, equals, [])
      networkStatus.pub("connected")
      expect(networkStatusSpy.calls, equals, [["connected"]])
    },

    async "applies state changes"() {
      const {store} = await setUpStore()
      store.apply(3)
      expect(store.state.get(), is, 3)
    },

    async "merges updates"() {
      const {store} = await setUpStore()
      store.apply(3)
      store.apply(2)
      expect(store.state.get(), is, 5)
    },

    async "saves the state when it's changed locally"() {
      const {store, save} = await setUpStore()
      expect(save.calls, equals, [])
      store.apply(3)
      expect(save.calls, equals, [[3]])
    },

    async "sends the state to peers when a connection is first established"() {
      const {send, networkStatus} = await setUpStore()
      expect(send.calls, equals, [])
      networkStatus.pub("connected")
      expect(send.calls, equals, [[0]])
    },

    async "sends the state to peers when a connection is reestablished"() {
      const {send, networkStatus} = await setUpStore()
      expect(send.calls, equals, [])
      networkStatus.pub("connected")
      expect(send.calls, equals, [[0]])
      networkStatus.pub("reconnecting")
      expect(send.calls, equals, [[0]])
      networkStatus.pub("connected")
      expect(send.calls, equals, [[0], [0]])
    },

    async "updates local state when an update is received"() {
      const {store, remoteUpdates} = await setUpStore()
      remoteUpdates.pub(2)
      expect(store.state.get(), is, 2)
    },

    async "saves local state when an update is received"() {
      const {save, remoteUpdates} = await setUpStore()
      remoteUpdates.pub(2)
      expect(save.calls, equals, [[2]])
    },

    async "does not send local state to the network when an update is received"() {
      const {send, remoteUpdates} = await setUpStore()
      remoteUpdates.pub(2)
      expect(send.calls, equals, [])
    },

    async "merges local and remote updates"() {
      const {store, remoteUpdates} = await setUpStore()
      store.apply(3)
      remoteUpdates.pub(7)
      expect(store.state.get(), is, 10)
    },
  })
}
