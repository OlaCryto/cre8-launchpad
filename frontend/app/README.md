# Cre8 Frontend

React 19 + TypeScript + Vite 7 frontend for the Cre8 token launchpad.

## Quick Start

```bash
npm install
npm run dev
```

## Stack

- React 19, TypeScript, Vite 7
- Tailwind CSS + shadcn/ui (Radix primitives)
- TanStack Query v5 for data fetching
- viem for blockchain interactions
- Recharts for price charts
- GSAP for animations
- React Hook Form + Zod for validation

## Environment

The frontend connects to:
- **Backend API:** `http://localhost:3001` (Express server in `../server/`)
- **Avalanche RPC:** Configured in `src/config/wagmi.ts`
- **Active Network:** Set via `ACTIVE_NETWORK` in `src/config/wagmi.ts`
