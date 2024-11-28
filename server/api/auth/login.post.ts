import { z } from 'zod'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '~/lib/prisma'

// 通过环境变量获取当前项目 Secret
export const SECRET = useRuntimeConfig().authSecret
// 获取当前时间，用于 Token 签发时间
const currentTime = Math.floor(Date.now() / 1000)
// JWT 签发者
const cookieDomain = useRuntimeConfig().cookieDomain
// 30 秒
export const ACCESS_TOKEN_TTL = 30

export interface User {
  username: string
  nickname: string
}

export interface JwtPayload extends User {
  iss: string
  sub: string
  iat?: number
  exp?: number
}

interface TokensByUser {
  access: Map<string, string>
  refresh: Map<string, string>
}

export const tokensByUser: Map<string, TokensByUser> = new Map()

const credentialsSchema = z.object({
  username: z.string()
    .trim()
    .min(4, '用户名必须至少有4个字符')
    .max(32, '用户名不得超过32个字符'),
  password: z.string()
    .trim()
    .min(6, '密码必须至少有6个字符')
    .max(64, '密码不得超过64个字符'),
})

export default defineEventHandler(async (event) => {
  const result = credentialsSchema.safeParse(await readBody(event))

  // 判断数据校验是否通过
  if (!result.success) {
    throw createError({
      statusCode: 400,
      statusMessage: result.error.errors[0].message,
    })
  }

  const { username } = result.data

  // 通过用户名查找是否已存在该用户
  const userFromDb = await prisma.user.findUnique({
    where: { username },
  })

  // 判断用户是否存在
  if (!userFromDb) {
    throw createError({
      statusCode: 403,
      statusMessage: '用户不存在',
    })
  }

  // 判断该账号密码是否正确
  const compare = await bcrypt.compare(result.data.password, userFromDb.password)

  if (!compare) {
    throw createError({
      statusCode: 400,
      statusMessage: '用户名或密码错误',
    })
  }

  // 判断用户账号当前状态
  switch (userFromDb.status) {
    case 'BANNED':
      throw createError({
        statusCode: 400,
        statusMessage: '账号已封禁，请联系管理员',
      })
    case 'SUSPENDED':
      throw createError({
        statusCode: 400,
        statusMessage: '账号已锁定，请稍后重试',
      })
    case 'DELETED':
      throw createError({
        statusCode: 403,
        statusMessage: '用户不存在',
      })
  }

  const tokenData: JwtPayload = {
    iss: cookieDomain,
    sub: userFromDb.id,
    iat: currentTime,
    username: userFromDb.username,
    nickname: userFromDb.nickname,
  }

  const accessToken = jwt.sign(tokenData, SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  })

  const refreshToken = jwt.sign(tokenData, SECRET, {
    // 1 day
    expiresIn: 60 * 60 * 24,
  })

  const userTokens: TokensByUser = tokensByUser.get(username) ?? {
    access: new Map(),
    refresh: new Map(),
  }
  userTokens.access.set(accessToken, refreshToken)
  userTokens.refresh.set(refreshToken, accessToken)
  tokensByUser.set(username, userTokens)

  return {
    token: {
      accessToken,
      refreshToken,
    },
  }
})

export function extractToken(authorizationHeader: string) {
  const match = authorizationHeader.match(/^Bearer (.+)$/)
  return match ? match[1] : ''
}
