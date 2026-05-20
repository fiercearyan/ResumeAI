import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@Injectable()
@WebSocketGateway({ path: '/ws/v1', cors: { origin: true } })
export class ScoreGateway {
  @WebSocketServer() server!: Server;

  @SubscribeMessage('subscribe')
  subscribe(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    if (typeof room === 'string' && room) client.join(room);
    return { ok: true, room };
  }

  emit(room: string, payload: any) {
    this.server?.to(room).emit('score:update', { room, ...payload, ts: Date.now() });
  }
}
