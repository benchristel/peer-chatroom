export function spy() {
  const calls = [];
  const spyFunc = function(...args) {
    calls.push(args);
  };
  spyFunc.calls = calls;
  return spyFunc;
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay90ZXN0LXV0aWxzLnRzIl0sCiAgIm1hcHBpbmdzIjogIkFBS08sc0JBQTBDO0FBQy9DLFFBQU0sUUFBOEI7QUFDcEMsUUFBTSxVQUFVLFlBQVksTUFBcUI7QUFDL0MsVUFBTSxLQUFLO0FBQUE7QUFFYixVQUFRLFFBQVE7QUFDaEIsU0FBTztBQUFBOyIsCiAgIm5hbWVzIjogW10KfQo=
