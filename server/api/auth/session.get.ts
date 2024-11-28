import { createError, eventHandler, getRequestHeader } from 'h3'
import jwt from 'jsonwebtoken'
import { type JwtPayload, SECRET, extractToken, tokensByUser } from './login.post'

export default eventHandler((event) => {
  const authorizationHeader = getRequestHeader(event, 'Authorization')
  if (typeof authorizationHeader === 'undefined') {
    throw createError({
      statusCode: 403,
      statusMessage: '需要传递有效的 Bearer-authorization 标头才能访问此端点',
    })
  }

  const extractedToken = extractToken(authorizationHeader)
  let decoded: JwtPayload
  try {
    decoded = jwt.verify(extractedToken, SECRET) as JwtPayload
  }
  catch (error) {
    console.error({
      msg: '登录失败，以下是原始错误：',
      error,
    })
    throw createError({
      statusCode: 403,
      statusMessage: '您必须登录才能使用此端点',
    })
  }

  // Check against known token
  const userTokens = tokensByUser.get(decoded.username)
  if (!userTokens || !userTokens.access.has(extractedToken)) {
    throw createError({
      statusCode: 401,
      statusMessage: '未授权，用户未登录',
    })
  }

  // All checks successful
  const { iss, sub, iat, exp, username, nickname } = decoded
  return {
    iss,
    sub,
    iat,
    exp,
    username,
    nickname,
  }
})
