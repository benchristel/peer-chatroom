import {h, Fragment} from "preact"
import {useState, useEffect} from "preact/hooks"
import {join} from "./chatroom"
import type {Room, ConnectionStatus} from "./chatroom"
import {append, toArray, merge} from "./CrdtLog"
import type {CrdtLog} from "./CrdtLog"

type ChatLog = CrdtLog<string>

const myAgentId = String(Math.random())
export function App(): JSX.Element {
  const [room, setRoom] = useState<null | Room<ChatLog>>(null)
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("pending")
  const [chatLog, setChatLog] = useState<ChatLog>({nextIndex: 0, entries: {}})

  function getChatLog(): ChatLog {
    let chatLog: ChatLog
    setChatLog(x => chatLog = x)
    return chatLog!
  }

  useEffect(() => {
    join("ben", {
      onConnectionStatusChanged: setConnStatus,
      onMessage(incoming: ChatLog) {
        setChatLog(chatLog => merge(chatLog, incoming))
      },
      getGreeting: getChatLog,
    }).then(room => {
      setRoom(room)
    })
  }, []) // passing [] as the second argument prevents re-joining on every render

  return <ChatView
    connStatus={connStatus}
    onSubmit={message => {
      const newChatLog = append(myAgentId, message, chatLog)
      setChatLog(newChatLog)
      room?.say(newChatLog)
    }}
    chatLog={chatLog}
  />
}

function ChatView(props: {
  connStatus: ConnectionStatus,
  chatLog: ChatLog,
  onSubmit: (message: string) => unknown,
}): JSX.Element {
  switch (props.connStatus) {
    case "pending":
      return <p>loading...</p>
    case "reconnecting":
      return <>
        <p>Error! Reconnecting...</p>
        <ChatLog data={props.chatLog}/>
      </>
    case "connected":
      return <>
        <p>Connected!</p>
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
