import {h, Fragment} from "../_snowpack/pkg/preact.js";
import {useState, useEffect} from "../_snowpack/pkg/preact/hooks.js";
import {DistributedDocument} from "./DistributedDocument.js";
import {append, toArray, merge} from "./CrdtLog.js";
const myAgentId = String(Math.random());
export function App() {
  const [doc, setDoc] = useState(null);
  const [connStatus, setConnStatus] = useState("pending");
  const [chatLog, setChatLog] = useState({nextIndex: 0, entries: {}});
  const [whosOnline, setWhosOnline] = useState(new Set([myAgentId]));
  useEffect(() => {
    const docPromise = DistributedDocument({
      documentId: "chatroom",
      agentId: Promise.resolve(myAgentId),
      load() {
        const json = localStorage["chatlog"] || '{"nextIndex":0,"entries":{}}';
        return Promise.resolve(JSON.parse(json));
      },
      save(state) {
        localStorage["chatlog"] = JSON.stringify(state);
      },
      merge(a, b) {
        return merge(a, b);
      }
    });
    docPromise.then((doc2) => {
      setDoc(doc2);
      setConnStatus(doc2.networkStatus.get());
      doc2.networkStatus.sub(setConnStatus);
      setChatLog(doc2.state.get());
      doc2.state.sub(setChatLog);
      doc2.whosOnline.sub(setWhosOnline);
    });
    return () => docPromise.then((doc2) => doc2.close());
  }, []);
  return doc && /* @__PURE__ */ h(ChatView, {
    connStatus,
    onSubmit: (message) => {
      const newChatLog = append(myAgentId, message, doc.state.get());
      doc.apply(newChatLog);
    },
    chatLog,
    peersOnline: whosOnline.size
  }) || /* @__PURE__ */ h(Loading, null);
}
function Loading() {
  return /* @__PURE__ */ h("p", null, "Loading...");
}
function ChatView(props) {
  switch (props.connStatus) {
    case "pending":
    case "reconnecting":
      return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("p", null, "Looking for peers..."), /* @__PURE__ */ h(ChatLog, {
        data: props.chatLog
      }), /* @__PURE__ */ h(ChatInput, {
        onSubmit: props.onSubmit
      }));
    case "connected":
      return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("p", null, "Connected! ", props.peersOnline, " peers online"), /* @__PURE__ */ h(ChatLog, {
        data: props.chatLog
      }), /* @__PURE__ */ h(ChatInput, {
        onSubmit: props.onSubmit
      }));
  }
}
function ChatLog(props) {
  return /* @__PURE__ */ h("ul", null, toArray(props.data).map((message) => /* @__PURE__ */ h("li", null, message)));
}
function ChatInput(props) {
  const [message, setMessage] = useState("");
  function submit() {
    props.onSubmit(message);
    setMessage("");
  }
  return /* @__PURE__ */ h(Fragment, null, /* @__PURE__ */ h("input", {
    type: "text",
    value: message,
    onChange: (e) => setMessage(e.target.value)
  }), /* @__PURE__ */ h("button", {
    onClick: submit
  }, "Send"));
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay9zcmMvQXBwLnRzeCJdLAogICJtYXBwaW5ncyI6ICJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBTUEsTUFBTSxZQUFZLE9BQU8sS0FBSztBQUN2QixzQkFBNEI7QUFDakMsUUFBTSxDQUFDLEtBQUssVUFBVSxTQUE4QztBQUNwRSxRQUFNLENBQUMsWUFBWSxpQkFBaUIsU0FBd0I7QUFDNUQsUUFBTSxDQUFDLFNBQVMsY0FBYyxTQUFrQixDQUFDLFdBQVcsR0FBRyxTQUFTO0FBQ3hFLFFBQU0sQ0FBQyxZQUFZLGlCQUFpQixTQUFzQixJQUFJLElBQUksQ0FBQztBQUVuRSxZQUFVLE1BQU07QUFDZCxVQUFNLGFBQWEsb0JBQTZCO0FBQUEsTUFDOUMsWUFBWTtBQUFBLE1BQ1osU0FBUyxRQUFRLFFBQVE7QUFBQSxNQUN6QixPQUFPO0FBQ0wsY0FBTSxPQUFPLGFBQWEsY0FBYztBQUN4QyxlQUFPLFFBQVEsUUFBUSxLQUFLLE1BQU07QUFBQTtBQUFBLE1BRXBDLEtBQUssT0FBZ0I7QUFDbkIscUJBQWEsYUFBYSxLQUFLLFVBQVU7QUFBQTtBQUFBLE1BRTNDLE1BQU0sR0FBWSxHQUFZO0FBQzVCLGVBQU8sTUFBTSxHQUFHO0FBQUE7QUFBQTtBQUlwQixlQUFXLEtBQUssVUFBTztBQUNyQixhQUFPO0FBQ1Asb0JBQWMsS0FBSSxjQUFjO0FBQ2hDLFdBQUksY0FBYyxJQUFJO0FBQ3RCLGlCQUFXLEtBQUksTUFBTTtBQUNyQixXQUFJLE1BQU0sSUFBSTtBQUNkLFdBQUksV0FBVyxJQUFJO0FBQUE7QUFHckIsV0FBTyxNQUFNLFdBQVcsS0FBSyxVQUFPLEtBQUk7QUFBQSxLQUN2QztBQUdILFNBQU8sT0FBTyxrQkFBQyxVQUFEO0FBQUEsSUFDWjtBQUFBLElBQ0EsVUFBVSxhQUFXO0FBQ25CLFlBQU0sYUFBYSxPQUFPLFdBQVcsU0FBUyxJQUFJLE1BQU07QUFDeEQsVUFBSSxNQUFNO0FBQUE7QUFBQSxJQUVaO0FBQUEsSUFDQSxhQUFhLFdBQVc7QUFBQSxRQUNwQixrQkFBQyxTQUFEO0FBQUE7QUFHUixtQkFBZ0M7QUFDOUIsU0FBTyxrQkFBQyxLQUFELE1BQUc7QUFBQTtBQUdaLGtCQUFrQixPQUtGO0FBQ2QsVUFBUSxNQUFNO0FBQUEsU0FDUDtBQUFBLFNBQ0E7QUFDSCxhQUFPLGtDQUNMLGtCQUFDLEtBQUQsTUFBRyx5QkFDSCxrQkFBQyxTQUFEO0FBQUEsUUFBUyxNQUFNLE1BQU07QUFBQSxVQUNyQixrQkFBQyxXQUFEO0FBQUEsUUFBVyxVQUFVLE1BQU07QUFBQTtBQUFBLFNBRTFCO0FBQ0gsYUFBTyxrQ0FDTCxrQkFBQyxLQUFELE1BQUcsZUFBWSxNQUFNLGFBQVksa0JBQ2pDLGtCQUFDLFNBQUQ7QUFBQSxRQUFTLE1BQU0sTUFBTTtBQUFBLFVBQ3JCLGtCQUFDLFdBQUQ7QUFBQSxRQUFXLFVBQVUsTUFBTTtBQUFBO0FBQUE7QUFBQTtBQUtuQyxpQkFBaUIsT0FBcUM7QUFDcEQsU0FBTyxrQkFBQyxNQUFELE1BQ0osUUFBUSxNQUFNLE1BQU0sSUFBSSxhQUFXLGtCQUFDLE1BQUQsTUFBSztBQUFBO0FBUTdDLG1CQUFtQixPQUFvQztBQUNyRCxRQUFNLENBQUMsU0FBUyxjQUFjLFNBQWlCO0FBRS9DLG9CQUFrQjtBQUNoQixVQUFNLFNBQVM7QUFDZixlQUFXO0FBQUE7QUFHYixTQUFPLGtDQUNMLGtCQUFDLFNBQUQ7QUFBQSxJQUNFLE1BQUs7QUFBQSxJQUNMLE9BQU87QUFBQSxJQUNQLFVBQVUsQ0FBQyxNQUFXLFdBQVcsRUFBRSxPQUFPO0FBQUEsTUFFNUMsa0JBQUMsVUFBRDtBQUFBLElBQVEsU0FBUztBQUFBLEtBQVE7QUFBQTsiLAogICJuYW1lcyI6IFtdCn0K
