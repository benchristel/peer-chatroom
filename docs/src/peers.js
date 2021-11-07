export async function createPeer(peerId) {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerId);
    peer.on("open", () => resolve(peer));
    peer.on("error", reject);
  });
}
export async function connect(me, otherPeerId) {
  return new Promise((resolve, reject) => {
    let conn;
    me.on("error", reject);
    conn = me.connect(otherPeerId);
    conn.on("error", reject);
    conn.on("close", reject);
    conn.on("open", () => {
      console.log("successfully connected to " + otherPeerId);
      resolve(conn);
    });
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay9zcmMvcGVlcnMudHMiXSwKICAibWFwcGluZ3MiOiAiQUFBQSxpQ0FBaUMsUUFBZ0M7QUFDL0QsU0FBTyxJQUFJLFFBQVEsQ0FBQyxTQUFTLFdBQVc7QUFDdEMsVUFBTSxPQUFPLElBQUksS0FBSztBQUN0QixTQUFLLEdBQUcsUUFBUSxNQUFNLFFBQVE7QUFDOUIsU0FBSyxHQUFHLFNBQVM7QUFBQTtBQUFBO0FBSXJCLDhCQUE4QixJQUFVLGFBQThDO0FBQ3BGLFNBQU8sSUFBSSxRQUFRLENBQUMsU0FBUyxXQUFXO0FBQ3RDLFFBQUk7QUFDSixPQUFHLEdBQUcsU0FBUztBQUNmLFdBQU8sR0FBRyxRQUFRO0FBQ2xCLFNBQUssR0FBRyxTQUFTO0FBQ2pCLFNBQUssR0FBRyxTQUFTO0FBRWpCLFNBQUssR0FBRyxRQUFRLE1BQU07QUFDcEIsY0FBUSxJQUFJLCtCQUErQjtBQUMzQyxjQUFRO0FBQUE7QUFBQTtBQUFBOyIsCiAgIm5hbWVzIjogW10KfQo=
