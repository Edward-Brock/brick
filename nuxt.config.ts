// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', '@sidebase/nuxt-auth'],
  devtools: { enabled: true },
  runtimeConfig: {
    authSecret: process.env.AUTH_SECRET, // Project Secret
    cookieDomain: process.env.COOKIE_DOMAIN, // JWT Cookie Domain
  },
  compatibilityDate: '2024-11-01',
  auth: {
    provider: {
      type: 'local',
      endpoints: {
        signIn: { path: '/login', method: 'post' },
        signOut: { path: '/logout', method: 'post' },
        signUp: { path: '/register', method: 'post' },
        getSession: { path: '/session', method: 'get' },
      },
      token: {
        signInResponseTokenPointer: '/token/accessToken',
      },
      refresh: {
        endpoint: { path: '/refresh', method: 'post' },
        token: {
          signInResponseRefreshTokenPointer: '/token/refreshToken',
          refreshRequestTokenPointer: '/refreshToken',
        },
      },
      pages: {
        login: '/login',
      },
    },
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
