import { ObjectId } from 'mongodb';
import { ApiError, errorResponse, mapMessage, normalizeText, parseMetadata, withMessages } from '@/lib/mongodb';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '10', 10) || 10));
    const query = normalizeText(searchParams.get('query')).trim();
    const author = normalizeText(searchParams.get('author')).trim();
    const source = normalizeText(searchParams.get('source')).trim();
    const category = normalizeText(searchParams.get('category')).trim();
    const status = searchParams.get('status');
    const order = searchParams.get('order') === 'oldest' ? 1 : -1;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    return await withMessages(request, async (messages) => {
      await Promise.all([
        messages.updateMany({ title: { $exists: false } }, { $set: { title: '' } }),
        messages.updateMany({ category: { $exists: false } }, { $set: { category: null } })
      ]);
      const filters = [];
      if (query) {
        const expression = new RegExp(escapeRegex(query), 'i');
        filters.push({ $or: [{ title: expression }, { text: expression }] });
      }
      if (author) filters.push({ author: new RegExp(escapeRegex(author), 'i') });
      if (source) filters.push({ source: new RegExp(escapeRegex(source), 'i') });
      if (category) filters.push({ category });
      if (status === 'read') filters.push({ isRead: true });
      if (status === 'unread') filters.push({ isRead: { $ne: true } });
      if (from || to) {
        const articleTime = {};
        if (from) articleTime.$gte = new Date(`${from}T00:00:00.000Z`);
        if (to) articleTime.$lte = new Date(`${to}T23:59:59.999Z`);
        if (Object.values(articleTime).some((date) => Number.isNaN(date.getTime()))) throw new ApiError('Date filter is invalid.', 400);
        filters.push({ articleTime });
      }
      const match = filters.length ? { $and: filters } : {};
      const [documents, total, totalMessages, authors, sources, categories] = await Promise.all([
        messages.aggregate([
          { $match: match },
          { $set: { _hasArticleTime: { $cond: [{ $eq: [{ $type: '$articleTime' }, 'date'] }, 1, 0] } } },
          { $sort: { _hasArticleTime: -1, articleTime: order, createdAt: -1, _id: -1 } },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          { $unset: '_hasArticleTime' }
        ]).toArray(),
        messages.countDocuments(match),
        messages.estimatedDocumentCount(),
        messages.distinct('author'),
        messages.distinct('source'),
        messages.distinct('category', { category: { $type: 'string', $ne: '' } })
      ]);
      return Response.json({
        messages: documents.map(mapMessage),
        pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
        totalMessages,
        suggestions: {
          authors: authors.filter((value) => typeof value === 'string'),
          sources: sources.filter((value) => typeof value === 'string'),
          categories: categories.filter((value) => typeof value === 'string').sort((left, right) => left.localeCompare(right))
        }
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const title = normalizeText(body.title).trim();
    const category = normalizeText(body.category).trim() || null;
    const text = normalizeText(body.text).trim();
    if (!text) {
      throw new ApiError('Message text is required.', 400);
    }

    const metadata = parseMetadata(body);
    return await withMessages(request, async (messages) => {
      const document = { _id: new ObjectId(), title, category, text, ...metadata, isRead: false, createdAt: new Date() };
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
