# Private Chat Web Admin

A static HTML/CSS/JavaScript manager for messages shared with the Private Chat VS Code extension. GitHub Pages publishes the files in `docs/`.

## Message Schema

The website and extension use the same MongoDB collection and document shape:

```json
{
  "_id": "ObjectId",
  "text": "message content",
  "createdAt": "Date"
}
```

Defaults:

- Database: `private_chat`
- Collection: `messages`

## Static Website

The deployable website is entirely contained in:

```text
docs/
  .nojekyll
  index.html
  styles.css
  app.js
```

It has no build step and uses relative asset URLs, so it works at a GitHub Pages repository URL.

## Connection Modes

Open **Connection** in the website and select one mode.

## One Shared Connection String

Use one JSON string for the website, extension, and server deployment reference:

```json
{"MONGODB_URI":"mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net","MONGODB_DATABASE":"private_chat","MONGODB_COLLECTION":"messages","CORS_ORIGIN":"https://YOUR_USER.github.io","API_BASE_URL":"https://YOUR_API_HOST.example.com"}
```

Paste the complete single-line string in two places:

1. Website: **Connection > Shared connection string > Save and test**.
2. VS Code: run **Private Chat: Configure MongoDB** and paste the same string.

The extension uses `MONGODB_URI`, `MONGODB_DATABASE`, and `MONGODB_COLLECTION`. The website uses `API_BASE_URL`. Your API host uses the first four values as environment variables. The API host still requires setting its environment variables through Render, Railway, or another deployment platform; a browser cannot configure server environment variables.

### Hosted REST API

This is the working option for new MongoDB Atlas projects. Deploy `server.js` to a Node host such as Render or Railway, then enter its public URL in the static website.

Example:

```text
https://private-chat-api.example.com
```

The website appends `/api/health` and `/api/messages` itself.

Configure the Node host with:

```dotenv
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER.mongodb.net
MONGODB_DATABASE=private_chat
MONGODB_COLLECTION=messages
PORT=3000
CORS_ORIGIN=https://YOUR_USER.github.io
```

For unrestricted personal testing, `CORS_ORIGIN=*` also works.

### Atlas Data API (Legacy)

This mode directly calls the old Atlas Data API from browser JavaScript. MongoDB retired Atlas Data API and App Services HTTPS endpoints, so this option only works for an Atlas project that already has an active legacy endpoint.

The website stores the entered endpoint and API key in browser `localStorage`. They are not committed to this repository, but JavaScript running on the page can access them.

## Local Run

Create `.env` from `.env.example`, set the MongoDB URI, then run:

```powershell
npm install
npm start
```

Open `http://localhost:3000`, select **Hosted REST API**, and enter:

```text
http://localhost:3000
```

## Deploy GitHub Pages

1. Push this project to a GitHub repository.
2. Open repository **Settings > Pages**.
3. Choose **Deploy from a branch**.
4. Select the branch containing this project, usually `main`.
5. Select the `/docs` folder and save.
6. Open `https://YOUR_USER.github.io/REPOSITORY/`.
7. Open **Connection** and enter the deployed REST API URL or an existing legacy Atlas Data API configuration.

## API

- `GET /api/health`
- `GET /api/messages`
- `POST /api/messages` with `{ "text": "..." }`
- `PATCH /api/messages/:id` with `{ "text": "..." }`
- `DELETE /api/messages/:id`
- `DELETE /api/messages`

## VS Code Extension

Configure the extension with the same MongoDB URI, database, and collection. The extension reads documents created by the website because both use actual MongoDB `ObjectId` and `Date` values.

The extension currently reloads messages when its view renders; it does not subscribe to live database changes.
