import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { config } from './config';

const client = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: { accessKeyId: config.s3.accessKey, secretAccessKey: config.s3.secretKey },
  forcePathStyle: true,
});

export async function putScreenshot(applicationId: string, png: Buffer, label: string): Promise<string> {
  const key = `${applicationId}/${Date.now()}-${label}-${randomUUID().slice(0, 6)}.png`;
  await client.send(new PutObjectCommand({
    Bucket: config.s3.applyBucket,
    Key: key,
    Body: png,
    ContentType: 'image/png',
  }));
  return key;
}

export async function getResume(s3Key: string): Promise<Buffer> {
  const r = await client.send(new GetObjectCommand({ Bucket: config.s3.resumesBucket, Key: s3Key }));
  const stream = r.Body as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.from(c));
  return Buffer.concat(chunks);
}
