import {h, Fragment} from "preact"
import {useState, useEffect} from "preact/hooks"
import {join} from "./chatroom"
import type {Room, ConnectionStatus} from "./chatroom"
import {append, toArray} from "./CrdtLog"
import type {CrdtLog} from "./CrdtLog"

const myAgentId = String(Math.random())
export function App(): JSX.Element {
  const [room, setRoom] = useState<null | Room<string>>(null)
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("pending")
  const [chatLog, setChatLog] = useState<CrdtLog<string>>({nextIndex: 0, entries: {}})

  useEffect(() => {
    join("ben", {
      handleConnectionStatusChanged: setConnStatus,
      handleMessage(message) {
        setChatLog(chatLog => append("", message, chatLog))
      },
      getGreeting: () => "hello"
    }).then(room => {
      setRoom(room)
    })
  }, [])

  return <ChatView
    connStatus={connStatus}
    onSubmit={message => {
      room?.say(message)
      setChatLog(append(myAgentId, message, chatLog))
    }}
    chatLog={chatLog}
  />
}

function ChatView(props: {
  connStatus: ConnectionStatus,
  chatLog: CrdtLog<string>,
  onSubmit: (message: string) => unknown,
}): JSX.Element {
  switch (props.connStatus) {
    case "pending":
      return <p>loading...</p>
    case "reconnecting":
      return <p>Error! Reconnecting...</p>
    case "connected":
      return <>
        <p>Connected!</p>
        <ChatLog data={props.chatLog}/>
        <ChatInput onSubmit={props.onSubmit}/>
      </>
  }
}

function ChatLog(props: {data: CrdtLog<string>}): JSX.Element {
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
