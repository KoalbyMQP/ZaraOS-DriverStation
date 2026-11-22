declare namespace NodeJS {
  // Written by the kumo-shadcn registry (https://github.com/tom-ricci/kumo-shadcn).
  // Kumo's components read process.env.NODE_ENV to print development
  // warnings, and bundlers replace it at build time. This gives it a type in
  // apps without @types/node (Vite's default tsconfig). With @types/node
  // installed, these declarations merge with Node's own.
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
  interface Process {
    env: ProcessEnv;
  }
}
declare var process: NodeJS.Process;
