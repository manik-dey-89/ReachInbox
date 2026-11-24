import type { User } from '../shared-index';
import { ApiError } from '../middleware/errorHandler';
import { userRepository } from '../repositories/user.repository';
import { redis } from '../config/redis';

export class AuthService {
  async getCurrentUser(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    }
    return user;
  }

  async logout(sessionId: string): Promise<void> {
    // connect-redis stores sessions under the key "sess:<sessionId>"
    await redis.del(`sess:${sessionId}`);
  }
}

export const authService = new AuthService();
