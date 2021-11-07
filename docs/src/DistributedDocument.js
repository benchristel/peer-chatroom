import {createPeriodical, createPubSub} from "./periodical.js";
import {createPeer, connect} from "./peers.js";
import {sleep} from "./substrate.js";
export async function DistributedDocument(config) {
  const [initialState, agentId] = await Promise.all([
    config.load(),
    config.agentId
  ]);
  const state = createPeriodical(initialState);
  const updates = createPubSub();
  const networkStatus = createPeriodical("pending");
  const whosOnline = createPeriodical(new Set());
  let network = nullNetwork;
  (async () => network = await PeerNetwork(agentId, config.documentId, state.get, networkStatus.pub, whosOnline.pub, updates.pub))();
  updates.sub((patch) => {
    console.log(agentId + " got update", patch);
    const newState = config.merge(state.get(), patch);
    config.save(newState);
    state.pub(newState);
  });
  return {
    state,
    networkStatus,
    whosOnline,
    apply,
    close
  };
  function apply(patch) {
    const newState = config.merge(state.get(), patch);
    config.save(newState);
    state.pub(newState);
    network.send(patch);
  }
  function close() {
    network.disconnect();
  }
}
const nullNetwork = {
  send() {
  },
  disconnect() {
  }
};
async function PeerNetwork(agentId, documentId, data, networkStatus, whosOnline, update) {
  let agent = deadAgent;
  let shouldReconnect = true;
  const agentConfig = {
    id: agentId,
    documentId,
    onUpdate: update,
    onOnlineAgentsChanged: whosOnline,
    getCurrentState: data
  };
  (async () => {
    while (true) {
      if (!shouldReconnect)
        break;
      agent = await createHost(agentConfig);
      networkStatus("connected");
      await agent.death;
      if (!shouldReconnect)
        break;
      networkStatus("reconnecting");
      agent = await createClient(agentConfig);
      networkStatus("connected");
      await agent.death;
      if (!shouldReconnect)
        break;
      networkStatus("reconnecting");
      await sleep(2);
    }
  })();
  return {
    send(data2) {
      agent.send(data2);
    },
    disconnect() {
      shouldReconnect = false;
      agent.disconnect();
    }
  };
}
async function createHost(config) {
  const timeToLiveSeconds = 10;
  const hostId = "h" + config.documentId;
  const connections = new Map();
  const [death, die] = resolvablePromise();
  let peer;
  try {
    console.log(config.id + " trying to connect as host");
    peer = await createPeer(hostId);
    console.log(config.id + " connected!");
  } catch (e) {
    return deadAgent;
  }
  const cleanupInterval = setInterval(() => {
    let deletedAny = false;
    eachConnection((c) => {
      const metadata = connections.get(c);
      if (metadata && --metadata.timeToLive <= 0) {
        console.log("closing expired connection to " + metadata.agentId);
        c.close();
        connections.delete(c);
        deletedAny = true;
      }
    });
    if (deletedAny)
      tellEveryoneWhosOnline();
  }, 1e3);
  peer.on("disconnected", disconnect);
  peer.on("error", disconnect);
  peer.on("connection", (conn) => {
    conn.on("close", () => closeConnection(conn));
    conn.on("error", () => closeConnection(conn));
    conn.on("data", (msg) => {
      switch (msg.type) {
        case "heartbeat":
          const metadata = connections.get(conn);
          if (metadata) {
            metadata.timeToLive = timeToLiveSeconds;
          }
          break;
        case "hello":
          connections.set(conn, {
            agentId: msg.agentId,
            timeToLive: timeToLiveSeconds
          });
          conn.send({type: "document", data: config.getCurrentState()});
          tellEveryoneWhosOnline();
          break;
        case "document":
          config.onUpdate(msg.data);
          eachConnection((c) => c !== conn && c.send(msg));
          break;
      }
    });
  });
  function send(data) {
    eachConnection((c) => c.send({type: "document", data}));
  }
  function disconnect() {
    clearInterval(cleanupInterval);
    peer.destroy();
    die();
  }
  function closeConnection(conn) {
    console.log("connection lost; deleting it");
    conn.close();
    connections.delete(conn);
    tellEveryoneWhosOnline();
  }
  function tellEveryoneWhosOnline() {
    const agentIds = [config.id, ...[...connections.values()].map((x) => x.agentId)];
    config.onOnlineAgentsChanged(new Set(agentIds));
    eachConnection((c) => c.send({
      type: "whosOnline",
      agentIds
    }));
  }
  function eachConnection(callback) {
    for (const conn of connections.keys()) {
      callback(conn);
    }
  }
  return {
    send,
    disconnect,
    death
  };
}
async function createClient(config) {
  const hostPeerId = "h" + config.documentId;
  let peer;
  try {
    console.log(config.id + " trying to connect as peer");
    peer = await createPeer();
    console.log(config.id + " connected!");
  } catch (e) {
    return deadAgent;
  }
  const [death, die] = resolvablePromise();
  peer.on("error", disconnect);
  const hostConn = await connect(peer, hostPeerId);
  hostConn.on("close", disconnect);
  hostConn.on("error", disconnect);
  hostConn.on("data", (msg) => {
    switch (msg.type) {
      case "whosOnline":
        config.onOnlineAgentsChanged(new Set(msg.agentIds));
        break;
      case "document":
        config.onUpdate(msg.data);
        break;
    }
  });
  hostConn.send({
    type: "hello",
    agentId: config.id
  });
  hostConn.send({
    type: "document",
    data: config.getCurrentState()
  });
  const heartbeatInterval = setInterval(() => {
    hostConn.send({type: "heartbeat"});
  }, 5e3);
  function send(data) {
    hostConn.send({
      type: "document",
      data
    });
  }
  function disconnect() {
    clearInterval(heartbeatInterval);
    peer.destroy();
    die();
  }
  return {
    send,
    disconnect,
    death
  };
}
const deadAgent = {
  send() {
  },
  disconnect() {
  },
  death: Promise.resolve()
};
function resolvablePromise() {
  let resolve = () => {
  };
  const promise = new Promise((_resolve) => resolve = _resolve);
  return [promise, resolve];
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay9zcmMvRGlzdHJpYnV0ZWREb2N1bWVudC50cyJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBRUE7QUFDQTtBQXVCQSwwQ0FDRSxRQUNpQztBQUNqQyxRQUFNLENBQUMsY0FBYyxXQUFXLE1BQU0sUUFBUSxJQUFJO0FBQUEsSUFDaEQsT0FBTztBQUFBLElBQ1AsT0FBTztBQUFBO0FBR1QsUUFBTSxRQUFnQixpQkFBaUI7QUFDdkMsUUFBTSxVQUFnQjtBQUN0QixRQUFNLGdCQUFnQixpQkFBZ0M7QUFDdEQsUUFBTSxhQUFnQixpQkFBOEIsSUFBSTtBQUV4RCxNQUFJLFVBQVU7QUFDYixFQUFDLGFBQ0EsVUFBVSxNQUFNLFlBQ2QsU0FDQSxPQUFPLFlBQ1AsTUFBTSxLQUNOLGNBQWMsS0FDZCxXQUFXLEtBQ1gsUUFBUTtBQUlaLFVBQVEsSUFBSSxXQUFTO0FBQ25CLFlBQVEsSUFBSSxVQUFVLGVBQWU7QUFDckMsVUFBTSxXQUFXLE9BQU8sTUFBTSxNQUFNLE9BQU87QUFDM0MsV0FBTyxLQUFLO0FBQ1osVUFBTSxJQUFJO0FBQUE7QUFHWixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQTtBQUdGLGlCQUFlLE9BQWdCO0FBQzdCLFVBQU0sV0FBVyxPQUFPLE1BQU0sTUFBTSxPQUFPO0FBQzNDLFdBQU8sS0FBSztBQUNaLFVBQU0sSUFBSTtBQUNWLFlBQVEsS0FBSztBQUFBO0FBR2YsbUJBQWlCO0FBQ2YsWUFBUTtBQUFBO0FBQUE7QUEwQlosTUFBTSxjQUE0QjtBQUFBLEVBQ2hDLE9BQU87QUFBQTtBQUFBLEVBQ1AsYUFBYTtBQUFBO0FBQUE7QUFHZiwyQkFDRSxTQUNBLFlBQ0EsTUFDQSxlQUNBLFlBQ0EsUUFDd0I7QUFDeEIsTUFBSSxRQUFxQjtBQUN6QixNQUFJLGtCQUEyQjtBQUUvQixRQUFNLGNBQWM7QUFBQSxJQUNsQixJQUFJO0FB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
