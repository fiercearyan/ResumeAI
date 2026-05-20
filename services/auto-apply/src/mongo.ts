import { MongoClient, ObjectId } from 'mongodb';

const url = process.env.MONGO_URL || 'mongodb://mongo:27017/resumeai';
let clientPromise: Promise<MongoClient> | null = null;

function client(): Promise<MongoClient> {
  if (!clientPromise) {
    clientPromise = new MongoClient(url).connect();
  }
  return clientPromise;
}

export async function loadParsedResume(mongoDocId: string): Promise<any | null> {
  const c = await client();
  const doc = await c.db().collection('resume_documents').findOne({ _id: new ObjectId(mongoDocId) });
  return doc?.parsed ?? null;
}
