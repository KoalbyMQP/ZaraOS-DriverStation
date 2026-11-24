declare namespace NodeJS {
  // Written by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
  // Kumo's components read process.env.NODE_ENV to print development
  // warnings, and bundlers replace it at build time. The global `process`
  // itself comes from @types/node, which this package and the app both
  // install; these declarations merge with Node's own.
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  interface Process {
    env: ProcessEnv;
  }
}
