# SoundAsleep Frontend

React app for the SoundAsleep study. Participants enter a code, choose an assigned soundscape, and listen while playback events are tracked.

## Development

```bash
npm install
npm run dev
```

Set `VITE_API_URL` when pointing at a non-default backend.

- **Development:** defaults to `http://localhost:3000`
- **Production:** defaults to `https://soundasleep-app.onrender.com`

If `VITE_API_URL` is set to a localhost value in production, it is ignored automatically.

You can also proxy through Vercel with `VITE_API_URL=/api` (see `vercel.json`).

## Build

```bash
npm run build
```

Audio and image assets belong in `public/`.
