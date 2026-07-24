import { MongoClient, ObjectId } from 'mongodb';

export const databaseName = 'private_chat';
export const collectionName = 'messages';

export function getMongoUri(request) {
  const encodedUri = request.headers.get('x-mongodb-uri');
  if (!encodedUri) {
    throw new ApiError('MongoDB URI is required.', 401);
  }

  let uri;
  try {
    uri = decodeURIComponent(encodedUri);
  } catch {
    throw new ApiError('MongoDB URI is invalid.', 400);
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new ApiError('MongoDB URI must start with mongodb:// or mongodb+srv://.', 400);
  }
  return uri;
}

export async function withMessages(request, operation) {
  const client = new MongoClient(getMongoUri(request), {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000
  });

  try {
    await client.connect();
    return await operation(client.db(databaseName).collection(collectionName), client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export function mapMessage(document) {
  return {
    id: document._id.toHexString(),
    text: document.text,
    createdAt: document.createdAt instanceof Date
      ? document.createdAt.toISOString()
      : document.createdAt
  };
}

export function parseObjectId(value) {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) {
    throw new ApiError('Invalid message ID.', 400);
  }
  return new ObjectId(value);
}

export class ApiError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(error) {
  const status = error instanceof ApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : String(error);
  return Response.json({ error: message }, { status });
}
