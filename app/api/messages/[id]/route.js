import { ApiError, errorResponse, mapMessage, parseMetadata, parseObjectId, withMessages } from '@/lib/mongodb';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const objectId = parseObjectId(id);
    const body = await request.json();
    const updates = {};
    if (Object.hasOwn(body, 'text')) {
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) {
        throw new ApiError('Message text is required.', 400);
      }
      updates.text = text;
    }
    if (Object.hasOwn(body, 'isRead')) {
      if (typeof body.isRead !== 'boolean') {
        throw new ApiError('Read status must be a boolean.', 400);
      }
      updates.isRead = body.isRead;
    }
    if (!Object.keys(updates).length && !Object.hasOwn(body, 'author') && !Object.hasOwn(body, 'source') && !Object.hasOwn(body, 'articleTime')) {
      throw new ApiError('Message text is required.', 400);
    }

    const parsedMetadata = (Object.hasOwn(body, 'author') || Object.hasOwn(body, 'source') || Object.hasOwn(body, 'articleTime'))
      ? parseMetadata(body)
      : {};
    const metadata = {};
    if (Object.hasOwn(body, 'author')) metadata.author = parsedMetadata.author;
    if (Object.hasOwn(body, 'source')) metadata.source = parsedMetadata.source;
    if (Object.hasOwn(body, 'articleTime')) metadata.articleTime = parsedMetadata.articleTime;
    return await withMessages(request, async (messages) => {
      const message = await messages.findOneAndUpdate(
        { _id: objectId },
        { $set: { ...updates, ...metadata } },
        { returnDocument: 'after' }
      );
      if (!message) {
        throw new ApiError('Message not found.', 404);
      }
      return Response.json({ message: mapMessage(message) });
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const objectId = parseObjectId(id);
    return await withMessages(request, async (messages) => {
      const result = await messages.deleteOne({ _id: objectId });
      if (!result.deletedCount) {
        throw new ApiError('Message not found.', 404);
      }
      return Response.json({ deleted: true });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
