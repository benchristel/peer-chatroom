import {render, h} from "preact"
import {App} from "./src/App"
import {DistributedDocument} from "./src/DistributedDocument"
window.DistributedDocument = DistributedDocument

render(<App/>, document.getElementById("app")!)
