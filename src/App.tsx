import {h, Fragment} from "preact"
import {useState, useEffect} from "preact/hooks"
import {DistributedDocument} from "./DistributedDocument"
import {append, toArray, merge} from "./CrdtLog"
import type {CrdtLog} from "./CrdtLog"
import type {NetworkStatus} from "./DistributedDocument"

type ChatLog = CrdtLog<string>

const myAgentId = String(Math.random())
export function App(): JSX.Element {
  const [doc, setDoc] = useState<DistributedDocument<ChatLog> | null>(null)
  const [connStatus, setConnStatus] = useState<NetworkStatus>("pending")
  const [chatLog, setChatLog] = useState<ChatLog>({nextIndex: 0, entries: {}})
  const [whosOnline, setWhosOnline] = useState<Set<string>>(new Set([myAgentId]))

  useEffect(() => {
    const docPromise = DistributedDocument<ChatLog>({
      documentId: "chatroom",
      agentId: Promise.resolve(myAgentId),
      load() {
        const json = localStorage["chatlog"] || '{"nextIndex":0,"entries":{}}'
        return Promise.resolve(JSON.parse(json))
      },
      save(state: ChatLog) {
        localStorage["chatlog"] = JSON.stringify(state)
      },
      merge(a: ChatLog, b: ChatLog) {
        return merge(a, b)
      },
    })

    docPromise.then(doc => {
      setDoc(doc)
      setConnStatus(doc.networkStatus.get())
      doc.networkStatus.sub(setConnStatus)
      setChatLog(doc.state.get())
      doc.state.sub(setChatLog)
      doc.whosOnline.sub(setWhosOnline)
    })

    return () => docPromise.then(doc => doc.close())
  }, []) // passing [] as the second argument prevents
  // recreating the doc on every render, which would be slow

  return doc && <ChatView
    connStatus={connStatus}
    onSubmit={message => {
      const newChatLog = append(myAgentId, message, doc.state.get())
      doc.apply(newChatLog)
    }}
    chatLog={chatLog}
    peersOnline={whosOnline.size}
  /> || <Loading/>
}

function Loading(): JSX.Element {
  return <p>Loading...</p>
}

function ChatView(props: {
  connStatus: NetworkStatus,
  chatLog: ChatLog,
  onSubmit: (message: string) => unknown,
  peersOnline: number,
}): JSX.Element {
  switch (props.connStatus) {
    case "pending":
    case "reconnecting":
      return <>
        <p>Looking for peers...</p>
        <ChatLog data={props.chatLog}/>
        <ChatInput onSubmit={props.onSubmit}/>
      </>
    case "connected":
      return <>
        <p>Connected! {props.peersOnline} peers online</p>
        <ChatLog data={props.chatLog}/>
        <ChatInput onSubmit={props.onSubmit}/>
      </>
  }
}

function ChatLog(props: {data: ChatLog}): JSX.Element {
  return <ul>
    {toArray(props.data).map(message => <li>{message}</li>)}
  </ul>
}

type ChatInputProps = {
  onSubmit: (message: string) => unknown,
}

function ChatInput(props: ChatInputProps): JSX.Element {
  const [message, setMessage] = useState<string>("")

  function submit() {
    props.onSubmit(message)
    setMessage("")
  }

  return <>
    <input
      type="text"
      value={message}
      onChange={(e: any) => setMessage(e.target.value)}
    />
    <button onClick={submit}>Send</button>
  </>
}
