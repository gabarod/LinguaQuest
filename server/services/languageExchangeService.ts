import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { db } from '@db';
import { users, buddyConnections } from '@db/schema';
import { eq } from 'drizzle-orm';
import { logger } from './loggingService';

interface User {
  id: number;
  username: string;
  socket: WebSocket;
  targetLanguage?: string;
  nativeLanguage?: string;
  proficiencyLevel?: string;
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
    logger.info('Language Exchange Service initialized');
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
      let userId: number;

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          logger.debug('Received WebSocket message', { type: data.type });

          switch (data.type) {
            case 'init':
              userId = data.userId;
              const user = await this.getUserInfo(userId);
              if (user) {
                this.connectedUsers.set(userId, { 
                  ...user, 
                  socket: ws,
                  targetLanguage: data.targetLanguage,
                  nativeLanguage: data.nativeLanguage,
                  proficiencyLevel: data.proficiencyLevel
                });
                logger.info('User connected to language exchange', { 
                  userId,
                  targetLanguage: data.targetLanguage,
                  proficiencyLevel: data.proficiencyLevel
                });
              }
              break;

            case 'start-search':
              if (userId) {
                this.startSearching(userId, data.targetLanguage, data.nativeLanguage, data.proficiencyLevel);
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
                  logger.debug('Forwarded signaling message', {
                    from: userId,
                    to: data.to,
                    type: data.signalingType
                  });
                }
              }
              break;

            case 'chat-message':
              if (userId && data.to && this.connectedUsers.has(data.to)) {
                const targetSocket = this.connectedUsers.get(data.to)?.socket;
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                  targetSocket.send(JSON.stringify({
                    type: 'chat-message',
                    message: data.message,
                    from: userId,
                    timestamp: new Date().toISOString()
                  }));
                  logger.info('Chat message sent', {
                    from: userId,
                    to: data.to
                  });
                }
              }
              break;
          }
        } catch (error) {
          logger.error('WebSocket message error:', { error, userId });
        }
      });

      ws.on('close', () => {
        if (userId) {
          this.stopSearching(userId);
          this.connectedUsers.delete(userId);
          logger.info('User disconnected from language exchange', { userId });
        }
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', { error, userId });
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

  private startSearching(userId: number, targetLanguage: string, nativeLanguage: string, proficiencyLevel: string) {
    const user = this.connectedUsers.get(userId);
    if (!user) return;

    user.targetLanguage = targetLanguage;
    user.nativeLanguage = nativeLanguage;
    user.proficiencyLevel = proficiencyLevel;
    user.searching = true;
    this.searchingUsers.add(userId);

    logger.info('User started searching for language partner', {
      userId,
      targetLanguage,
      proficiencyLevel
    });

    // Find a matching partner with similar proficiency level
    for (const [partnerId, partner] of this.connectedUsers.entries()) {
      if (
        partnerId !== userId &&
        partner.searching &&
        partner.targetLanguage === user.nativeLanguage &&
        partner.nativeLanguage === user.targetLanguage &&
        this.isProficiencyCompatible(user.proficiencyLevel, partner.proficiencyLevel)
      ) {
        this.matchUsers(userId, partnerId);
        break;
      }
    }
  }

  private isProficiencyCompatible(level1?: string, level2?: string): boolean {
    if (!level1 || !level2) return true;

    const levels = ['beginner', 'intermediate', 'advanced'];
    const idx1 = levels.indexOf(level1);
    const idx2 = levels.indexOf(level2);

    // Allow matching if levels are adjacent or the same
    return Math.abs(idx1 - idx2) <= 1;
  }

  private stopSearching(userId: number) {
    const user = this.connectedUsers.get(userId);
    if (user) {
      user.searching = false;
      logger.info('User stopped searching for language partner', { userId });
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

    logger.info('Users matched for language exchange', {
      user1Id,
      user2Id,
      language1: user1.targetLanguage,
      language2: user2.targetLanguage
    });

    // Notify both users about the match
    const matchData = (partnerId: number, partnerName: string, partnerLevel: string) => ({
      type: 'match-found',
      partnerId,
      partnerName,
      partnerLevel,
      timestamp: new Date().toISOString()
    });

    user1.socket.send(JSON.stringify(matchData(user2Id, user2.username, user2.proficiencyLevel || 'unknown')));
    user2.socket.send(JSON.stringify(matchData(user1Id, user1.username, user1.proficiencyLevel || 'unknown')));
  }
}