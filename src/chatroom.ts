import {sleep, remove, cycleForever} from "./substrate"

export type Room<Msg> = {
  say: (message: Msg) => void,
}

export type ConnectionStatus =
  | "pending"
  | "connected"
  | "reconnecting"

export type RoomConfig<Msg> = {
  handleMessage: (message: Msg) => unknown,
  handleConnectionStatusChanged: (status: ConnectionStatus) => unknown,
  getGreeting: () => Msg,
}

export async function join<Msg>(
  roomName: string,
  config: RoomConfig<Msg>,
): Promise<Room<Msg>> {
  const hostId = "howdy-" + roomName
  let send = await init()
  return {
    say(msg: Msg) {
      send(msg)
    }
  }

  async function reconnect() {
    send = () => {}
    config.handleConnectionStatusChanged("reconnecting")
    send = await init()
  }

  async function init(): Promise<(msg: Msg) => void> {
    for (const strategy of cycleForever([host, joinAsClient, backOff])) {
      try {
        const send = await strategy({
          hostId,
          handleMessage: config.handleMessage,
          getGreeting: config.getGreeting,
          handleDeath: reconnect,
        })
        config.handleConnectionStatusChanged("connected")
        return send
      } catch (e) {
        console.warn(e)
        // go around again
      }
    }
    return () => {} // unreachable
  }
}

type Send<Msg> = (msg: Msg) => void

type BehaviorConfig<Msg> = {
  hostId: string,
  handleMessage: (msg: Msg) => unknown,
  getGreeting: () => Msg,
  handleDeath: () => unknown,
}

async function joinAsClient<Msg>(
  config: BehaviorConfig<Msg>,
): Promise<Send<Msg>> {
  let peer = await createPeer()
  console.log("Joined as client")

  const {
    hostId,
    handleMessage,
    getGreeting,
    handleDeath,
  } = config

  console.log("connecting to " + hostId)
  const host: DataConnection = await connect(peer, hostId)

  host.send(getGreeting())
  host.on("data", (msg: Msg) => handleMessage(msg))
  host.on("close", die)
  host.on("error", die)
  peer.on("error", die)

  function die(error: Error) {
    console.log("I've lost touch with the host, and can't go on", error)
    peer.destroy()
    handleDeath()
  }

  return (msg: Msg) => {
    host.send(msg)
  }
}

async function host<Msg>(
  config: BehaviorConfig<Msg>,
): Promise<Send<Msg>> {
  let peer = await createPeer(config.hostId)
  console.log("Joined as host")

  const {
    getGreeting,
    handleMessage,
    handleDeath,
  } = config

  const connections: Array<DataConnection> = []

  peer.on("connection", (conn: DataConnection) => {
    conn.on("open", () => {
      connections.push(conn)
      conn.send(getGreeting())
    })
    conn.on("close", () => remove(conn, connections))
    conn.on("error", () => remove(conn, connections))
    conn.on("data", (msg: Msg) => {
      connections.forEach(otherConn => {
        if (otherConn !== conn) {
          otherConn.send(msg)
        }
      })
      handleMessage(msg)
    })
  })

  peer.on("error", (e: Error) => {
    connections.forEach(conn => conn.close())
    connections.length = 0
    peer.destroy()
    handleDeath()
  })

  return function(msg: Msg) {
    connections.forEach(conn => conn.send(msg))
  }
}

async function backOff(config: unknown): Promise<never> {
  await sleep(2)
  throw new Error("Failed to connect as either host or client. Waiting a bit...")
}

async function connect(me: Peer, otherPeerId: string): Promise<DataConnection> {
  return new Promise((resolve, reject) => {
    let conn: void | DataConnection
    me.on("error", reject)
    conn = me.connect(otherPeerId)
    conn.on("error", reject)
    conn.on("close", reject)

    conn.on("open", () => {
      console.log("successfully connected to " + otherPeerId)
      resolve(conn)
    })
  })
}

async function createPeer(peerId?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerId)
    peer.on("open", () => resolve(peer))
    peer.on("error", reject)
  })
}
