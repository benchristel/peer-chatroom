export type Room<Msg> = {
  say: (message: Msg) => void,
}

type RoomConfig<Msg> = {
  handleMessage: (message: Msg) => unknown,
  handleConnectionStatusChanged: (status: ConnectionStatus) => unknown,
  getGreeting: () => Msg,
}

export type ConnectionStatus =
  | "pending"
  | "connected"
  | "reconnecting"

type Send<Msg> = (msg: Msg) => void

async function joinAsClient<Msg>(
  config: BehaviorConfig<Msg>,
): Promise<Send<Msg>> {
  let peer = await tryToCreatePeer()
  return behaveAsClient(peer, config)
}

async function claimHost<Msg>(
  config: BehaviorConfig<Msg>,
): Promise<Send<Msg>> {
  let peer = await tryToClaimHost(config.hostId)
  return behaveAsHost(peer, config)
}

async function backOff(config: unknown): Promise<never> {
  await sleep(2)
  throw new Error("Failed to connect as either host or client. Waiting a bit...")
}

function *cycleForever<T>(options: Array<T>) {
  while (true) {
    for (let option of options) {
      yield option
    }
  }
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
    for (const strategy of cycleForever([claimHost, joinAsClient, backOff])) {
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
        // go around again
      }
    }
    return () => {} // unreachable
  }
}

async function tryToClaimHost(hostId: string): Promise<Peer> {
  return tryToCreatePeer(hostId)
}

async function tryToCreatePeer(peerId?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerId)
    peer.on("open", () => {
      resolve(peer)
    })
    peer.on("error", reject)
  })
}

type BehaviorConfig<Msg> = {
  hostId: string,
  handleMessage: (msg: Msg) => unknown,
  getGreeting: () => Msg,
  handleDeath: () => unknown,
}

// behaveAsHost assumes the peer passed to it is already open.
export function behaveAsHost<Msg>(
  peer: Peer,
  {
    getGreeting,
    handleMessage,
    handleDeath,
  }: BehaviorConfig<Msg>,
): Send<Msg> {
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

  function say(msg: Msg) {
    connections.forEach(conn => conn.send(msg))
  }

  return say
}

// behaveAsClient assumes the peer passed to it is already open.
async function behaveAsClient<Msg>(
  peer: Peer,
  {
    hostId,
    handleMessage,
    getGreeting,
    handleDeath,
  }: BehaviorConfig<Msg>,
): Promise<Send<Msg>> {
  return new Promise(resolve => {
    const hostConnection = peer.connect(hostId)
    hostConnection.on("open", () => {
      hostConnection.send(getGreeting())
      resolve((msg: Msg) => {
        hostConnection.send(msg)
      })
    })
    hostConnection.on("close", die)
    hostConnection.on("error", die)
    hostConnection.on("data", (msg: Msg) => {
      handleMessage(msg)
    })

    peer.on("error", die)

    function die() {
      peer.destroy()
      handleDeath()
    }
  })
}

function sleep(seconds: number) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

function remove<T>(elem: T, array: Array<T>): void {
  const index = array.indexOf(elem)
  if (index < 0) return;
  array.splice(index, 1)
}
