import { prisma } from '../config/database';
import type { User } from '../shared-index';

interface OAuthProfile {
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByOAuthProvider(provider: string, providerAccountId: string): Promise<User | null> {
    const oauthAccount = await prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    return oauthAccount?.user ?? null;
  }

  async upsertFromOAuth(profile: OAuthProfile): Promise<User> {
    return prisma.$transaction(async (tx) => {
      // Upsert the user record
      const user = await tx.user.upsert({
        where: { email: profile.email },
        create: {
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar ?? null,
        },
        update: {
          name: profile.name,
          avatar: profile.avatar ?? null,
        },
      });

      // Upsert the OAuth account link
      await tx.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
        create: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: profile.accessToken ?? null,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
        update: {
          accessToken: profile.accessToken ?? null,
          refreshToken: profile.refreshToken ?? null,
          expiresAt: profile.expiresAt ?? null,
        },
      });

      return user;
    });
  }

  async updateUser(id: string, data: Partial<{ name: string; avatar: string }>): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  }
}

export const userRepository = new UserRepository();
