import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { db } from '@db';
import { users, buddyConnections } from '@db/schema';
import { eq } from 'drizzle-orm';

interface User {
  id: number;
  username: string;
  socket: WebSocket;
  targetLanguage?: string;
  nativeLanguage?: string;
  searching?: boolean;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  from: number;
  to: number;
}

export class LanguageExchangeService {
  private wss: WebSocketServer;
  private connectedUsers: Map<number, User> = new Map();
  private searchingUsers: Set<number> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/language-exchange'
    });

    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      let userId: number;

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          
          switch (data.type) {
            case 'init':
              userId = data.userId;
              const user = await this.getUserInfo(userId);
              if (user) {
                this.connectedUsers.set(userId, { 
                  ...user, 
                  socket: ws,
                  targetLanguage: data.targetLanguage,
                  nativeLanguage: data.nativeLanguage
                });
              }
              break;

            case 'start-search':
              if (userId) {
                this.startSearching(userId, data.targetLanguage, data.nativeLanguage);
              }
              break;

            case 'stop-search':
              if (userId) {
                this.stopSearching(userId);
              }
              break;

            case 'signaling':
              if (userId && data.to && this.connectedUsers.has(data.to)) {
                const targetSocket = this.connectedUsers.get(data.to)?.socket;
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                  targetSocket.send(JSON.stringify({
                    type: data.signalingType,
                    data: data.signalingData,
                    from: userId
                  }));
                }
              }
              break;
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        if (userId) {
          this.stopSearching(userId);
          this.connectedUsers.delete(userId);
        }
      });
    });
  }

  private async getUserInfo(userId: number) {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }

  private startSearching(userId: number, targetLanguage: string, nativeLanguage: string) {
    const user = this.connectedUsers.get(userId);
    if (!user) return;

    user.targetLanguage = targetLanguage;
    user.nativeLanguage = nativeLanguage;
    user.searching = true;
    this.searchingUsers.add(userId);

    // Find a matching partner
    for (const [partnerId, partner] of this.connectedUsers) {
      if (
        partnerId !== userId &&
        partner.searching &&
        partner.targetLanguage === user.nativeLanguage &&
        partner.nativeLanguage === user.targetLanguage
      ) {
        this.matchUsers(userId, partnerId);
        break;
      }
    }
  }

  private stopSearching(userId: number) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      user.searching = false;
    }
    this.searchingUsers.delete(userId);
  }

  private matchUsers(user1Id: number, user2Id: number) {
    const user1 = this.connectedUsers.get(user1Id);
    const user2 = this.connectedUsers.get(user2Id);

    if (!user1 || !user2) return;

    // Stop searching for both users
    this.stopSearching(user1Id);
    this.stopSearching(user2Id);

    // Notify both users about the match
    const matchData = (partnerId: number, partnerName: string) => ({
      type: 'match-found',
      partnerId,
      partnerName,
    });

    user1.socket.send(JSON.stringify(matchData(user2Id, user2.username)));
    user2.socket.send(JSON.stringify(matchData(user1Id, user1.username)));
  }
}
