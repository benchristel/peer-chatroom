import {h, Fragment} from "preact"
import {useState, useEffect} from "preact/hooks"
import {join} from "./chatroom"
import type {Room} from "./chatroom"

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

type CrdtLog<T> = {
  nextIndex: number,
  entries: {
    [position: string]: T,
  },
}

function merge<T>(a: CrdtLog<T>, b: CrdtLog<T>): CrdtLog<T> {
  const nextIndex = Math.max(a.nextIndex, b.nextIndex)
  const entries = {...a.entries, ...b.entries}
  return {nextIndex, entries}
}

function toArray<T>(log: CrdtLog<T>): Array<T> {
  return Object.entries(log.entries)
    .sort(([a], [b]) => {
      const aIndex = Number(a.split(":")[0])
      const bIndex = Number(b.split(":")[0])
      if (aIndex !== bIndex) {
        return aIndex - bIndex
      } else {
        return a > b ? 1 : -1
      }
    })
    .map(([key, value]) => value)
}

function append<T>(agentId: string, item: T, log: CrdtLog<T>): CrdtLog<T> {
  return {
    nextIndex: log.nextIndex + 1,
    entries: {
      ...log.entries,
      [log.nextIndex + ":" + agentId]: item,
    },
  }
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

  switch (state.connection) {
    case "pending":
      return <p>loading...</p>
    case "reconnecting":
      return <p>Error! Reconnecting...</p>
    case "connected":
      return <>
        <p>Connected!</p>
        <ChatLog data={chatLog}/>
        <ChatInput onSubmit={message => {
          room?.say(message)
          setChatLog(append(myAgentId, message, chatLog))
        }}/>
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
