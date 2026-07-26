import { ObjectId } from 'mongodb';
import { ApiError, errorResponse, mapMessage, parseMetadata, withMessages } from '@/lib/mongodb';

export async function GET(request) {
  try {
    return await withMessages(request, async (messages) => {
      const documents = await messages.find().sort({ createdAt: -1, _id: -1 }).toArray();
      return Response.json({ messages: documents.map(mapMessage) });
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      throw new ApiError('Message text is required.', 400);
    }

    const metadata = parseMetadata(body);
    return await withMessages(request, async (messages) => {
      const document = { _id: new ObjectId(), text, ...metadata, isRead: false, createdAt: new Date() };
      await messages.insertOne(document);
      return Response.json({ message: mapMessage(document) }, { status: 201 });
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
  try {
    return await withMessages(request, async (messages) => {
      const result = await messages.deleteMany({});
      return Response.json({ deletedCount: result.deletedCount });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
