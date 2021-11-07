import "./src/App"

import {formatTestResultsAsText, runTests, getAllTests} from "@benchristel/taste"
import "./src/periodical"

document.getElementById("test-output")!.innerText = formatTestResultsAsText(await runTests(getAllTests()))
