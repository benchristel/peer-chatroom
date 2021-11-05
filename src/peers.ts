export async function createPeer(peerId?: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerId)
    peer.on("open", () => resolve(peer))
    peer.on("error", reject)
  })
}

export async function connect(me: Peer, otherPeerId: string): Promise<DataConnection> {
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
