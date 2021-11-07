import "./src/App.js";
import {formatTestResultsAsText, runTests, getAllTests} from "./_snowpack/pkg/@benchristel/taste.js";
import "./src/periodical.js";
document.getElementById("test-output").innerText = formatTestResultsAsText(await runTests(getAllTests()));
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay90ZXN0LnRzIl0sCiAgIm1hcHBpbmdzIjogIkFBQUE7QUFFQTtBQUNBO0FBRUEsU0FBUyxlQUFlLGVBQWdCLFlBQVksd0JBQXdCLE1BQU0sU0FBUzsiLAogICJuYW1lcyI6IFtdCn0K
