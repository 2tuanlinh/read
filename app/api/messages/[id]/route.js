import { ApiError, errorResponse, mapMessage, parseObjectId, withMessages } from '@/lib/mongodb';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const objectId = parseObjectId(id);
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) {
      throw new ApiError('Message text is required.', 400);
    }

    return await withMessages(request, async (messages) => {
      const message = await messages.findOneAndUpdate(
        { _id: objectId },
        { $set: { text } },
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
