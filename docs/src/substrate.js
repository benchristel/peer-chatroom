export function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
}
export function remove(elem, array) {
  const index = array.indexOf(elem);
  if (index < 0)
    return;
  array.splice(index, 1);
}
export function* cycleForever(options) {
  while (true) {
    for (let option of options) {
      yield option;
    }
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL0Jlbi93b3Jrc3BhY2UvbmV0d29yay9zcmMvc3Vic3RyYXRlLnRzIl0sCiAgIm1hcHBpbmdzIjogIkFBQU8sc0JBQWUsU0FBaUI7QUFDckMsU0FBTyxJQUFJLFFBQVEsYUFBVyxXQUFXLFNBQVMsVUFBVTtBQUFBO0FBR3ZELHVCQUFtQixNQUFTLE9BQXVCO0FBQ3hELFFBQU0sUUFBUSxNQUFNLFFBQVE7QUFDNUIsTUFBSSxRQUFRO0FBQUc7QUFDZixRQUFNLE9BQU8sT0FBTztBQUFBO0FBR2YsOEJBQTBCLFNBQW1CO0FBQ2xELFNBQU8sTUFBTTtBQUNYLGFBQVMsVUFBVSxTQUFTO0FBQzFCLFlBQU07QUFBQTtBQUFBO0FBQUE7IiwKICAibmFtZXMiOiBbXQp9Cg==
