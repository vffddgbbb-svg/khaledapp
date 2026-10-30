# Khaledapp

Build and prepare to publish a production-ready Arabic RTL shift scheduling web app called رفيق المناوبات. User wants a vibrant, cheerful yet professional design, mobile-first, and a real full-stack app (not a static mock). Auth: admin account is the only one allowed to create/invite member accounts; each member has their own login. Members can submit shift swap requests, but only admin can approve/reject; approved changes are reflected for everyone in real time. Include audit log (who/when/what), dashboard and searchable monthly calendar, shift-type colors, light/dark mode. Do NOT hardcode passwords. Use Supabase-backed auth/database/realtime and secure server-side role checks / RLS. Need a safe first-run admin setup flow that requires the owner to claim admin using a one-time setup token or secure confirmation; do not expose admin access publicly by default. This app must explicitly label any unconfigured/placeholder schedule data; do not invent schedule assignments and do not claim sync is active until DB configured. Build an Arabic RTL interface, friendly playful visual polish, accessible forms and loading/error/empty states. I have not supplied the full original schedule data in this prompt: set up import/upload for the original HTML schedule so we can import it rather than fabricating assignments. Explain any integration steps that still require human authorization, then prepare deploy.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://khaledapp.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f826536b-190c-4e21-a983-b01ac9235739).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
