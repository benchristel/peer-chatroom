import "./src/App"

import {formatTestResultsAsText, runTests, getAllTests} from "@benchristel/taste"
import "./src/periodical"
import "./src/PeerStore"

document.getElementById("test-output")!.innerText = formatTestResultsAsText(await runTests(getAllTests()))
