# Midnight World — Live Voice Rooms

This is a starter implementation of real multi-user voice rooms using LiveKit.

## What works after configuration
- Different users can enter the same room name and connect to the same live voice room.
- Microphone on/off.
- Live participant list.
- Room-wide text chat using LiveKit data messages.
- Leave room.

## Requirements
- Node.js 18+
- A LiveKit Cloud project (or your own LiveKit server)

## Setup
1. Extract this folder.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `server/.env.example` to `server/.env`.
5. In your LiveKit project dashboard, copy the WebSocket URL, API key, and API secret into `server/.env`.
6. Run `npm run dev`.
7. Open `http://localhost:5173` in your browser.
8. Open the same address in another browser/device, enter the same room name, and join.

The API secret must remain in `server/.env` on the server. Never publish it in frontend code or commit the `.env` file to GitHub.

## Deploying
This is a two-part app:
- Frontend: deploy the Vite client to a static hosting provider.
- Backend: deploy `server/index.js` to a Node.js hosting provider.
- Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` as backend environment variables.
- Update the frontend fetch URL in `client/main.js` to your deployed backend URL, and configure CORS for your frontend domain.

Do not use a development server as your production deployment.

## Important before inviting people
This is an early MVP, not a finished social network. It does not yet include full user accounts, persistent chat history, room discovery/listing, friend requests, gifts, host moderation controls, blocking/report review, or rate limits. Add authentication and server-side moderation before opening rooms publicly. Use invite-only rooms at first, and never share personal contact details in public rooms.
