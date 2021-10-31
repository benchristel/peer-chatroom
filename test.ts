import "./index"

import {formatTestResultsAsText, runTests, getAllTests} from "@benchristel/taste"

document.getElementById("test-output")!.innerText = formatTestResultsAsText(await runTests(getAllTests()))
