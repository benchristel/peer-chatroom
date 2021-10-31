export default {
  exclude: ['**/node_modules/**/*', '**/.git/**/*'],
  buildOptions: {
    sourcemap: "inline",
    out: "dist",
  },
  devOptions: {
    port: 8000,
  }
}
