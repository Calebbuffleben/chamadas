import { prisma } from './prisma';

interface UserInfo {
  email: string;
  name: string;
  department?: string;
}

export async function getOrCreateUser(userInfo: UserInfo) {
  try {
    // Try to find existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (existingUser) {
      return existingUser;
    }

    // Create new guest user
    const newUser = await prisma.user.create({
      data: {
        email: userInfo.email,
        name: userInfo.name,
        department: userInfo.department || 'Guest',
      },
    });

    return newUser;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
} 