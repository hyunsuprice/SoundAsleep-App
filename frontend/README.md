# SoundAsleep Frontend

React app for the SoundAsleep study. Participants enter a code, choose an assigned soundscape, and listen while playback events are tracked.

## Development

```bash
npm install
npm run dev
```

Set `VITE_API_URL` when pointing at a non-default backend.

- **Development:** defaults to `http://localhost:3000`
- **Production:** defaults to `/api`, proxied to Render via `vercel.json` (avoids CORS issues)

You can override with `VITE_API_URL`. If it is set to localhost in production, it is ignored.

## Build

```bash
npm run build
```

Audio and image assets belong in `public/`.
