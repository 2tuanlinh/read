import { MongoClient, ObjectId } from 'mongodb';

export const databaseName = 'private_chat';
export const collectionName = 'messages';
const clientCache = globalThis.__privateChatMongoClients || new Map();
globalThis.__privateChatMongoClients = clientCache;

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
  const uri = getMongoUri(request);
  let clientPromise = clientCache.get(uri);
  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      maxIdleTimeMS: 60000
    });
    clientPromise = client.connect().then(() => client).catch((error) => {
      clientCache.delete(uri);
      throw error;
    });
    clientCache.set(uri, clientPromise);
  }

  const client = await clientPromise;
  return operation(client.db(databaseName).collection(collectionName), client);
}

export function mapMessage(document) {
  return {
    id: document._id.toHexString(),
    title: normalizeText(document.title),
    category: typeof document.category === 'string' ? normalizeText(document.category) : null,
    text: normalizeText(document.text),
    author: normalizeMetadataValues(document.author),
    source: normalizeMetadataValues(document.source),
    isRead: document.isRead === true,
    articleTime: document.articleTime instanceof Date
      ? document.articleTime.toISOString()
      : document.articleTime || '',
    createdAt: document.createdAt instanceof Date
      ? document.createdAt.toISOString()
      : document.createdAt
  };
}

export function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/(\p{L})[ \t]+(\p{M})/gu, '$1$2').normalize('NFC');
}

export function parseMetadata(body) {
  const author = normalizeMetadataValues(body.author);
  const source = normalizeMetadataValues(body.source);
  let articleTime = null;
  if (typeof body.articleTime === 'string' && body.articleTime) {
    articleTime = new Date(`${body.articleTime.slice(0, 10)}T00:00:00.000Z`);
    if (Number.isNaN(articleTime.getTime())) {
      throw new ApiError('Article date is invalid.', 400);
    }
  }
  return { author, source, articleTime };
}

function normalizeMetadataValues(value) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  return [...new Set(values.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))];
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
