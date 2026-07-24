import { collectionName, databaseName, errorResponse, withMessages } from '@/lib/mongodb';

export async function GET(request) {
  try {
    return await withMessages(request, async (_messages, client) => {
      await client.db(databaseName).command({ ping: 1 });
      return Response.json({ ok: true, database: databaseName, collection: collectionName });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
