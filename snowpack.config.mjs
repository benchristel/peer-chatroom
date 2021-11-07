export default {
  exclude: ['**/node_modules/**/*', '**/.git/**/*'],
  buildOptions: {
    sourcemap: "inline",
    out: "docs",
  },
  devOptions: {
    port: 8000,
  }
}
