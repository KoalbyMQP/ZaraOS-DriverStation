This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Local auth bypass (development only)

To bypass the sign in locally: 

```bash
AUTH_BYPASS_LOCAL=true
NEXT_PUBLIC_AUTH_BYPASS_LOCAL=true
```

Set these values in your local environment (for example, `.env.local`) and run the app in development mode.
The bypass is hard-disabled unless `NODE_ENV=development`.