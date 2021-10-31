import {h, Fragment} from "preact"
import {useState, useEffect} from "preact/hooks"
import {join} from "./chatroom"
import type {Room, ConnectionStatus} from "./chatroom"
import {merge, append, toArray} from "./CrdtLog"
import type {CrdtLog} from "./CrdtLog"

type State =
  | {connection: "pending"}
  | {connection: "reconnecting"}
  | {connection: "connected"}

type AsyncCallbacks<Result> = {
  onSuccess: (result: Result) => unknown,
  onError: (error: Error) => unknown,
}

function callAsync<T, A>(
  f: (arg: A) => Promise<T>,
  args: A,
  callbacks: AsyncCallbacks<T>,
): void {
  f(args)
    .then(callbacks.onSuccess)
    .catch(callbacks.onError)
}

const myAgentId = String(Math.random())
export function App(): JSX.Element {
  const [room, setRoom] = useState<null | Room<string>>(null)
  const [state, setState] = useState<State>({connection: "pending"})
  const [chatLog, setChatLog] = useState<CrdtLog<string>>({nextIndex: 0, entries: {}})

  useEffect(() => {
    join("ben", {
      handleConnectionStatusChanged(status) {
        setState({connection: status})
      },
      handleMessage(message) {
        setChatLog(append("", message, chatLog))
      },
      getGreeting: () => "hello"
    }).then(room => {
      setRoom(room)
    })
  }, [])

  return <ChatView
    connection={state.connection}
    onSubmit={message => {
      room?.say(message)
      setChatLog(append(myAgentId, message, chatLog))
    }}
    chatLog={chatLog}
  />
}

function ChatView(props: {
  connection: ConnectionStatus,
  chatLog: CrdtLog<string>,
  onSubmit: (message: string) => unknown,
}): JSX.Element {
  switch (props.connection) {
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
