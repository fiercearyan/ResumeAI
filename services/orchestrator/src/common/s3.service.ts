import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class S3Service {
  // Internal client: talks to MinIO over the docker network for puts/gets.
  private client: S3Client;
  // Signing client: configured with the *public* endpoint so presigned URLs we
  // return to the browser embed `localhost:9000` and the SigV4 host signature
  // matches what the browser actually sends.
  private signingClient: S3Client;

  constructor() {
    const creds = {
      accessKeyId: process.env.S3_ACCESS_KEY || 'resumeai',
      secretAccessKey: process.env.S3_SECRET_KEY || 'resumeai_dev_secret',
    };
    const region = process.env.S3_REGION || 'us-east-1';
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
      region,
      credentials: creds,
      forcePathStyle: true,
    });
    this.signingClient = new S3Client({
      endpoint: process.env.S3_PUBLIC_ENDPOINT || 'http://localhost:9000',
      region,
      credentials: creds,
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
      this.signingClient,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: expiresInSec },
    );
  }
}
