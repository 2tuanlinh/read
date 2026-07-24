const path = require('path');
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const app = express();
const port = Number(process.env.PORT) || 3000;
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || 'private_chat';
const collectionName = process.env.MONGODB_COLLECTION || 'messages';
const corsOrigin = process.env.CORS_ORIGIN || '*';

if (!mongoUri) {
  console.error('MONGODB_URI is missing from .env');
  process.exit(1);
}

const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
/** @type {import('mongodb').Collection | null} */
let messages = null;

app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'docs')));

function isObjectId(value) {
  return typeof value === 'string' && ObjectId.isValid(value) && new ObjectId(value).toHexString() === value;
}

function mapMessage(doc) {
  return {
    id: doc._id.toHexString(),
    text: doc.text,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    await client.db(databaseName).command({ ping: 1 });
    res.json({
      ok: true,
      database: databaseName,
      collection: collectionName
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/api/messages', async (_req, res) => {
  try {
    const docs = await messages.find().sort({ createdAt: 1, _id: 1 }).toArray();
    res.json({ messages: docs.map(mapMessage) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const doc = {
      _id: new ObjectId(),
      text,
      createdAt: new Date()
    };
    await messages.insertOne(doc);
    res.status(201).json({ message: mapMessage(doc) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.patch('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      res.status(400).json({ error: 'Invalid message id.' });
      return;
    }

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const result = await messages.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { text } },
      { returnDocument: 'after' }
    );

    if (!result) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    res.json({ message: mapMessage(result) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      res.status(400).json({ error: 'Invalid message id.' });
      return;
    }

    const result = await messages.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Message not found.' });
      return;
    }

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete('/api/messages', async (_req, res) => {
  try {
    await messages.deleteMany({});
    res.status(204).end();
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

async function start() {
  await client.connect();
  messages = client.db(databaseName).collection(collectionName);
  await messages.findOne({}, { projection: { _id: 1 } });

  app.listen(port, () => {
    console.log(`Private Chat web admin: http://localhost:${port}`);
    console.log(`MongoDB: ${databaseName}.${collectionName}`);
  });
}

start().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});
