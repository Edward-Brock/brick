import jwt from 'jsonwebtoken'
import { type JwtPayload, SECRET, extractToken, tokensByUser } from './login.post'

export default eventHandler(async (event) => {
  const body = await readBody<{ refreshToken: string }>(event)
  const authorizationHeader = getRequestHeader(event, 'Authorization')
  const refreshToken = body.refreshToken

  if (!refreshToken || !authorizationHeader) {
    throw createError({
      statusCode: 401,
      statusMessage: '未授权，没有 refreshToken 或没有授权标头',
    })
  }

  // Verify
  const decoded = jwt.verify(refreshToken, SECRET) as JwtPayload | undefined
  if (!decoded) {
    throw createError({
      statusCode: 401,
      statusMessage: '未授权，无法验证 refreshToken',
    })
  }

  // Get tokens
  const userTokens = tokensByUser.get(decoded.username)

  if (!userTokens) {
    throw createError({
      statusCode: 401,
      statusMessage: '未授权，用户未登录',
    })
  }

  // Check against known token
  const requestAccessToken = extractToken(authorizationHeader)
  const knownAccessToken = userTokens.refresh.get(body.refreshToken)
  if (!knownAccessToken || knownAccessToken !== requestAccessToken) {
    console.log({
      msg: 'Tokens mismatch',
      knownAccessToken,
      requestAccessToken,
    })
    throw createError({
      statusCode: 401,
      statusMessage: 'Token 不匹配',
    })
  }

  // Invalidate old access token
  userTokens.access.delete(knownAccessToken)

  const user: JwtPayload = {
    iss: decoded.iss,
    sub: decoded.sub,
    username: decoded.username,
    nickname: decoded.nickname,
  }

  const accessToken = jwt.sign(user, SECRET, {
    expiresIn: 60 * 5, // 5 minutes
  })
  userTokens.refresh.set(refreshToken, accessToken)
  userTokens.access.set(accessToken, refreshToken)

  return {
    token: {
      accessToken,
      refreshToken,
    },
  }
})
