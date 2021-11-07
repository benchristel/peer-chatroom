import {createPeriodical, createPubSub} from "./periodical"
import type {Sub, Get, Consumer} from "./periodical"
import {createPeer, connect} from "./peers"
import {sleep} from "./substrate"

export type DistributedDocument<T> = {
  readonly state: Sub<T> & Get<T>,
  readonly networkStatus: Sub<NetworkStatus> & Get<NetworkStatus>,
  readonly whosOnline: Sub<Set<string>> & Get<Set<string>>,
  apply(patch: T): void,
  close(): void,
}

export type DistributedDocumentConfig<T> = {
  readonly documentId: string,
  readonly agentId: Promise<string>,
  load(): Promise<T>,
  save(data: T): void,
  merge(a: T, b: T): T,
}

export type NetworkStatus =
  | "pending"
  | "connected"
  | "reconnecting"

export async function DistributedDocument<T>(
  config: DistributedDocumentConfig<T>,
): Promise<DistributedDocument<T>> {
  const [initialState, agentId] = await Promise.all([
    config.load(),
    config.agentId,
  ])

  const state         = createPeriodical(initialState)
  const updates       = createPubSub<T>()
  const networkStatus = createPeriodical<NetworkStatus>("pending")
  const whosOnline    = createPeriodical<Set<string>>(new Set())

  let network = nullNetwork
  ;(async () =>
    network = await PeerNetwork<T>(
      agentId,
      config.documentId,
      state.get,
      networkStatus.pub,
      whosOnline.pub,
      updates.pub,
    )
  )()

  updates.sub(patch => {
    console.log(agentId + " got update", patch)
    const newState = config.merge(state.get(), patch)
    config.save(newState)
    state.pub(newState)
  })

  return {
    state,
    networkStatus,
    whosOnline,
    apply,
    close,
  }

  function apply(patch: T): void {
    const newState = config.merge(state.get(), patch)
    config.save(newState)
    state.pub(newState)
    network.send(patch)
  }

  function close() {
    network.disconnect()
  }
}

type Message<Data> =
  | {
      type: "whosOnline",
      agentIds: Array<string>,
    }
  | {
      type: "hello",
      agentId: string,
    }
  | {
      type: "document",
      data: Data,
    }
  | {
      type: "heartbeat",
    }

type Network<Data> = {
  send(d: Data): void,
  disconnect(): void,
}

const nullNetwork: Network<any> = {
  send() {},
  disconnect() {},
}

async function PeerNetwork<Data>(
  agentId: string,
  documentId: string,
  data: () => Data,
  networkStatus: Consumer<NetworkStatus>,
  whosOnline: Consumer<Set<string>>,
  update: Consumer<Data>,
): Promise<Network<Data>> {
  let agent: Agent<Data> = deadAgent;
  let shouldReconnect: boolean = true;

  const agentConfig = {
    id: agentId,
    documentId,
    onUpdate: update,
    onOnlineAgentsChanged: whosOnline,
    getCurrentState: data,
  }

  ;(async () => {
    while (true) {
      if (!shouldReconnect) break;
      agent = await createHost(agentConfig)
      networkStatus("connected")
      await agent.death
      if (!shouldReconnect) break;
      networkStatus("reconnecting")
      agent = await createClient(agentConfig)
      networkStatus("connected")
      await agent.death
      if (!shouldReconnect) break;
      networkStatus("reconnecting")
      await sleep(2)
    }
  })()

  return {
    send(data: Data) {
      agent.send(data)
    },
    disconnect() {
      shouldReconnect = false
      agent.disconnect()
    },
  }
}

type Agent<Data> = {
  send(data: Data): void,
  disconnect(): void,
  death: Promise<void>,
}

type AgentConfig<Data> = {
  id: string,
  documentId: string,
  onUpdate(data: Data): unknown,
  onOnlineAgentsChanged(agentIds: Set<string>): unknown,
  getCurrentState: () => Data,
}

type ConnectionMetadata = {
  agentId: string,
  timeToLive: number,
}

async function createHost<Data>(config: AgentConfig<Data>): Promise<Agent<Data>> {
  const timeToLiveSeconds = 10
  const hostId = "h" + config.documentId
  const connections = new Map<DataConnection, ConnectionMetadata>()
  const [death, die] = resolvablePromise()

  let peer: Peer
  try {
    console.log(config.id + " trying to connect as host")
    peer = await createPeer(hostId)
    console.log(config.id + " connected!")
  } catch (e) {
    return deadAgent
  }

  // on Firefox, PeerJS connections don't emit the "close"
  // event. To ensure dead connections get cleaned up
  // anyway, we have each peer send heartbeat messages while
  // it is alive. If the host doesn't receive a heartbeat
  // message for `timeToLiveSeconds`, it closes the
  // connection.
  const cleanupInterval = setInterval(() => {
    let deletedAny = false
    eachConnection(c => {
      const metadata = connections.get(c)
      if (metadata && --metadata.timeToLive <= 0) {
        console.log("closing expired connection to " + metadata.agentId)
        c.close()
        connections.delete(c)
        deletedAny = true
      }
    })
    if (deletedAny) tellEveryoneWhosOnline()
  }, 1000)

  // If we get disconnected from the signaling server,
  // it means the hostId is no longer reserved for us and
  // the next peer to join the document will claim it,
  // leading to a split-brained state. Destroy the peer to
  // ensure there's only one host.
  peer.on("disconnected", disconnect)

  peer.on("error", disconnect)

  peer.on("connection", (conn: DataConnection) => {
    conn.on("close", () => closeConnection(conn))
    conn.on("error", () => closeConnection(conn))
    conn.on("data", (msg: Message<Data>) => {
      switch (msg.type) {
        case "heartbeat":
          const metadata = connections.get(conn)
          if (metadata) {
            metadata.timeToLive = timeToLiveSeconds
          }
          break;
        case "hello":
          connections.set(conn, {
            agentId: msg.agentId,
            timeToLive: timeToLiveSeconds,
          })
          conn.send({type: "document", data: config.getCurrentState()})
          tellEveryoneWhosOnline()
          break;
        case "document":
          config.onUpdate(msg.data)
          eachConnection(c => c !== conn && c.send(msg))
          break;
      }
    })
  })

  function send(data: Data): void {
    eachConnection(c => c.send({type: "document", data}))
  }

  function disconnect() {
    clearInterval(cleanupInterval)
    peer.destroy()
    die()
  }

  function closeConnection(conn: DataConnection) {
    console.log("connection lost; deleting it")
    conn.close()
    connections.delete(conn)
    tellEveryoneWhosOnline()
  }

  function tellEveryoneWhosOnline() {
    const agentIds = [config.id, ...[...connections.values()].map(x => x.agentId)]
    config.onOnlineAgentsChanged(new Set(agentIds))
    eachConnection(c =>
      c.send({
        type: "whosOnline",
        agentIds,
      })
    )
  }

  function eachConnection(callback: (conn: DataConnection) => unknown): void {
    for (const conn of connections.keys()) {
      callback(conn)
    }
  }

  return {
    send,
    disconnect,
    death,
  }
}

async function createClient<Data>(config: AgentConfig<Data>): Promise<Agent<Data>> {
  const hostPeerId = "h" + config.documentId
  let peer: Peer
  try {
    console.log(config.id + " trying to connect as peer")
    peer = await createPeer()
    console.log(config.id + " connected!")
  } catch (e) {
    return deadAgent
  }

  const [death, die] = resolvablePromise()
  peer.on("error", disconnect)

  const hostConn = await connect(peer, hostPeerId)
  hostConn.on("close", disconnect)
  hostConn.on("error", disconnect)
  hostConn.on("data", (msg: Message<Data>) => {
    switch (msg.type) {
      case "whosOnline":
        config.onOnlineAgentsChanged(new Set(msg.agentIds))
        break;
      case "document":
        config.onUpdate(msg.data)
        break;
    }
  })

  hostConn.send({
    type: "hello",
    agentId: config.id,
  })

  hostConn.send({
    type: "document",
    data: config.getCurrentState(),
  })

  const heartbeatInterval = setInterval(() => {
    hostConn.send({type: "heartbeat"})
  }, 5000)

  function send(data: Data) {
    hostConn.send({
      type: "document",
      data,
    })
  }

  function disconnect() {
    clearInterval(heartbeatInterval)
    peer.destroy()
    die()
  }

  return {
    send,
    disconnect,
    death,
  }
}

const deadAgent = {
  send() {},
  disconnect() {},
  death: Promise.resolve(),
}

function resolvablePromise(): [Promise<void>, () => void] {
  let resolve: () => void = () => {}
  const promise = new Promise<void>(_resolve => resolve = _resolve)
  return [promise, resolve]
}
