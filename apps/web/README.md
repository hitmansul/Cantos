# Web App - Modern Stack

Next.js 16 application with React 19, Tailwind CSS v4, Better Auth, and React Query.

## Tech Stack

- **Next.js 16.0.0** - React framework with App Router
- **React 19.0.0** - UI library with new features
- **Tailwind CSS 4.0.0** - Utility-first CSS with Rust engine
- **Better Auth 1.1.7** - Modern authentication
- **TanStack Query 5.72.2** - Server state management
- **TypeScript 5.8.3** - Type safety

## Project Structure

```
apps/web/
│   ├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/         # Better Auth endpoints
│   │   └── session/      # Session info
│   ├── layout.tsx        # Root layout (Server Component)
│   ├── providers.tsx     # Client providers (React Query, etc.)
│   ├── page.tsx          # Home page
│   └── tailwind.css      # Tailwind v4 config
│   ├── lib/                   # Shared libraries
│   ├── auth.ts           # Better Auth server config
│   └── auth-client.ts    # Better Auth React hooks
├── src/                   # Utilities and shared code
│   └── utils/            # Helper functions
└── public/               # Static assets
```

## Getting Started

### 1. Install Dependencies

```bash
yarn install
```

### 2. Environment Variables

Create `.env.local`:

```env
# Database
DATABASE_URL=postgresql://...

# Authentication
AUTH_SECRET=your-secret-key-here
AUTH_URL=http://localhost:4000
NEXT_PUBLIC_AUTH_URL=http://localhost:4000

# Create Platform
NEXT_PUBLIC_CREATE_BASE_URL=https://www.create.xyz
NEXT_PUBLIC_CREATE_HOST=your-host
NEXT_PUBLIC_PROJECT_GROUP_ID=your-project-id

# Optional
CORS_ORIGINS=http://localhost:3000
```

### 3. Run Development Server

```bash
yarn dev
```

Open [http://localhost:4000](http://localhost:4000)

### 4. Build for Production

```bash
yarn build
yarn start
```

## Architecture Patterns

### Server Components (Default)

```tsx
// app/page.tsx
export default async function Page() {
  const data = await fetch('/api/data').then(r => r.json());
  return <div>{data.message}</div>;
}
```

### Client Components

```tsx
// app/interactive.tsx
'use client';

import { useState } from 'react';

export function Interactive() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

### React Query

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';

export function DataComponent() {
  const { data, isLoading } = useQuery({
    queryKey: ['data'],
    queryFn: () => fetch('/api/data').then(r => r.json()),
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>{data.message}</div>;
}
```

### Authentication

```tsx
'use client';

import { useSession, signIn, signOut } from '@/lib/auth-client';

export function AuthButton() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <button onClick={() => signIn.email({
        email: 'user@example.com',
        password: 'password',
      })}>
        Sign In
      </button>
    );
  }

  return (
    <div>
      <p>Welcome, {session.user.name}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### Protected Routes

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return <div>Protected content for {session.user.name}</div>;
}
```

## Styling with Tailwind v4

Tailwind v4 uses CSS-based configuration:

### Global Styles (`app/tailwind.css`)

```css
@import "tailwindcss";

@theme {
  --font-sans: 'Inter', sans-serif;
  --color-primary: #3b82f6;
}

@layer base {
  input {
    @apply outline-none;
  }
}
```

### Using Tailwind Classes

```tsx
export function Button() {
  return (
    <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
      Click me
    </button>
  );
}
```

## API Routes

### Basic API Route

```tsx
// app/api/hello/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Hello' });
}
```

### Protected API Route

```tsx
// app/api/protected/route.ts
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ user: session.user });
}
```

## Database

Using Neon PostgreSQL with Better Auth:

- Better Auth automatically manages auth tables
- Direct connection via `@neondatabase/serverless`
- WebSocket support configured

## Scripts

```bash
yarn dev        # Start development server
yarn build      # Build for production
yarn start      # Start production server
yarn typecheck  # Run TypeScript checks
```

## Key Features

### ✅ Modern Stack
- Latest Next.js 16 with App Router
- React 19 with new features
- Tailwind CSS v4 with Rust engine

### ✅ Type Safety
- Full TypeScript coverage
- Better Auth type inference
- React Query typed hooks

### ✅ Developer Experience
- Hot module replacement
- Fast refresh
- TypeScript autocomplete

### ✅ Performance
- Server Components by default
- Automatic code splitting
- Optimized builds with Rust

### ✅ Authentication
- Email/password auth
- Session management
- Protected routes

### ✅ State Management
- React Query for server state
- Zustand for client state
- Better Auth for auth state

## Migration Notes

This project was migrated from React Router + Vite + NextAuth.js to the current stack.

See [MIGRATION.md](./MIGRATION.md) for full details.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Better Auth](https://better-auth.com/docs)
- [TanStack Query](https://tanstack.com/query/latest)
