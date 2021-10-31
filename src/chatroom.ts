export type Room<Msg> = {
  say: (message: Msg) => void,
}

type RoomConfig<Msg> = {
  handleMessage: (message: Msg) => unknown,
  handleConnectionStatusChanged: (status: ConnectionStatus) => unknown,
  getGreeting: () => Msg,
}

type ConnectionStatus = "pending" | "connected" | "reconnecting"

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
    while (true) {
      try {
        const peer = await tryToClaimHost(hostId)
        const send = behaveAsHost<Msg>(peer, {
          handleMessage: config.handleMessage,
          getGreeting: config.getGreeting,
          handleDeath: reconnect,
        })
        console.log("became the host of " + hostId)
        config.handleConnectionStatusChanged("connected")
        return send
      } catch (e) {
        try {
          const peer = await tryToCreatePeer()
          const send = behaveAsClient<Msg>(peer, {
            hostId,
            handleMessage: config.handleMessage,
            getGreeting: config.getGreeting,
            handleDeath: reconnect,
          })
          console.log("joined " + hostId)
          config.handleConnectionStatusChanged("connected")
          return send
        } catch (e) {
          await sleep(2)
        }
      }
    }
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

type HostConfig<Msg> = {
  handleMessage: (msg: Msg) => unknown,
  getGreeting: () => Msg,
  handleDeath: () => unknown,
}

// behaveAsHost assumes the peer passed to it is already open.
export function behaveAsHost<Msg>(peer: Peer, {getGreeting, handleMessage, handleDeath}: HostConfig<Msg>): (msg: Msg) => void {
  const connections: Array<DataConnection> = []

  peer.on("connection", (conn: DataConnection) => {
    conn.on("open", () => {
      console.log("received connection from client")
      connections.push(conn)
      console.log("host will greet client: " + getGreeting())
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

type ClientConfig<Msg> = {
  hostId: string,
  handleMessage: (msg: Msg) => unknown,
  getGreeting: () => Msg,
  handleDeath: () => unknown,
}

// behaveAsClient assumes the peer passed to it is already open.
async function behaveAsClient<Msg>(peer: Peer, {hostId, handleMessage, getGreeting, handleDeath}: ClientConfig<Msg>): Promise<(msg: Msg) => void> {
  return new Promise(resolve => {
    console.log("client will establish connection to host")
    const hostConnection = peer.connect(hostId)
    hostConnection.on("open", () => {
      console.log("client will greet host", getGreeting())
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
