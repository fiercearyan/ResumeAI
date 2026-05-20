import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'resumeai',
        secretAccessKey: process.env.S3_SECRET_KEY || 'resumeai_dev_secret',
      },
      forcePathStyle: true,
    });
  }

  async putObject(bucket: string, body: Buffer, contentType: string, ext: string): Promise<string> {
    const key = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return key;
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const r = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const stream = r.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  async signedGetUrl(bucket: string, key: string, expiresInSec = 600) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }
}
