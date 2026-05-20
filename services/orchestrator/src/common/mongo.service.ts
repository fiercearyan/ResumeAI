import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MongoClient, Db, ObjectId } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client!: MongoClient;
  private database!: Db;

  async onModuleInit() {
    const url = process.env.MONGO_URL || 'mongodb://mongo:27017/resumeai';
    this.client = new MongoClient(url);
    await this.client.connect();
    this.database = this.client.db();
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  db() {
    return this.database;
  }

  newObjectId() {
    return new ObjectId();
  }
}
