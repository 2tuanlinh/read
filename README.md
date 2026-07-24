# Private Chat Manager

A responsive Next.js application for managing messages in a user-provided MongoDB database. It is designed for one-click deployment to Vercel.

## Behavior

- The MongoDB URI acts as the login credential.
- The URI is stored in that browser's `localStorage` until logout.
- Users can log out and connect with a different URI.
- The URI is sent to same-origin Next.js API routes for each database operation.
- The fixed database and collection are `private_chat.messages`.
- Messages use the schema `{ _id: ObjectId, text: string, createdAt: Date }`, matching the VS Code extension.

This design intentionally prioritizes convenience over secret security. A MongoDB URI stored in browser storage can be read by JavaScript running on the site.

## Local Development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000` and enter a MongoDB URI.

## Deploy To Vercel

1. Push this project to a GitHub repository.
2. Open [vercel.com](https://vercel.com) and select **Add New > Project**.
3. Import the GitHub repository.
4. Keep the detected framework as **Next.js**.
5. Do not add environment variables; users provide their own URI in the app.
6. Select **Deploy**.

Vercel runs the frontend and all `/api/*` route handlers in the same project.

## MongoDB Atlas Access

The Atlas cluster must permit connections from Vercel. In Atlas **Network Access**, allow the required source addresses. Vercel serverless outbound addresses are dynamic unless configured otherwise, so unrestricted `0.0.0.0/0` access is the simplest but least secure option.
