import { z } from 'zod'
import bcrypt from 'bcrypt'
import prisma from '~/lib/prisma'

const credentialsSchema = z.object({
  nickname: z.string()
    .trim()
    .min(1, '昵称必须至少有1个字符')
    .max(100, '昵称不得超过100个字符'),
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

  // 通过用户名查找是否已存在该用户
  const existingUser = await prisma.user.findUnique({ where: { username: result.data.username } })

  // 判断用户是否存在
  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: '用户已存在',
    })
  }

  // 加密用户名密码
  const hashedPassword = await bcrypt.hash(result.data.password, 10)

  const createdUser = await prisma.user.create({
    data: {
      nickname: result.data.nickname,
      username: result.data.username,
      password: hashedPassword,
    },
  })

  return {
    statusCode: 201,
    message: '账号注册成功',
    data: {
      user: {
        id: createdUser.id,
        nickname: createdUser.nickname,
        username: createdUser.username,
      },
    },
  }
})
