# FM Station Tracker

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

A modern, accessible FM radio station tracker with real-time geolocation and Google Maps navigation integration.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Authentication setup

The app requires login for every route except `/login`. Bootstrap the first admin before starting the dev server.

1. Generate a session secret:
   ```bash
   openssl rand -base64 32
   ```
2. Add to `.env.local`:
   ```
   SESSION_PASSWORD="<paste output above>"
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=<at least 8 chars>
   ADMIN_DISPLAY_NAME="<display name>"
   ```
3. Push schema and seed:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
4. Start dev:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`, log in with the admin credentials, then **change the admin password** from `/admin/users` (click "Reset password" on your own row).

Rotating `SESSION_PASSWORD` logs every user out (existing cookies become undecryptable).

### Behavior notes

- "Remember me" CHECKED → 7-day cookie. UNCHECKED → 2-hour cookie (approximation of a browser-session cookie since iron-session always attaches a maxAge).
- 5 failed login attempts in 15 minutes throttles that username for 15 minutes.
- Admins cannot disable or demote themselves (DB-enforced).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# Trigger Vercel redeploy
