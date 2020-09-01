import Koa from 'koa'
import KoaRouter from '@koa/router'
import websockify from 'koa-websocket'
import {
  getPreparedTrendFromTweets,
  openTwitterStream,
  Twitter,
} from './twitter'
import { get } from 'lodash'

const app = websockify(new Koa())
const wsRouter = new KoaRouter()
const router = new KoaRouter()

// {"command": "getTweets", "args": {"q": "Belarus", "count": "5"}}
wsRouter.all('/twitter', async (ctx) => {
  ctx.websocket.on('message', (message) => {
    try {
      const messageObj = JSON.parse(message)
      const command = get(messageObj, 'command')
      if (!command) {
        throw 'No command found'
      }
      const args = get(messageObj, 'args', {})
      switch (command) {
        case 'getTweets':
          Twitter.get('search/tweets', {
            q: args.q,
            count: 10,
            include_entities: false,
            include_rts: false,
            include_user_entities: false,
          })
            .then((d) => {
              const tweets = get(d.data, 'statuses')
              if (!tweets) {
                throw 'No tweets found'
              }
              const trendingCause = getPreparedTrendFromTweets(tweets, args.q)
              ctx.websocket.send(JSON.stringify(trendingCause))
              openTwitterStream(ctx, args)
            })
            .catch((err) => {
              throw err
            })

          break
        case 'ping':
          ctx.websocket.send(message)
          break
        default:
          throw 'Unknown command'
      }
    } catch (error) {
      ctx.websocket.send(
        JSON.stringify({ error: `Error: ${error}`, data: null })
      )
    }
  })
})

router.get('/ping', async (ctx) => {
  ctx.body = 'PONG'
})

app.use(router.routes())
app.use(router.allowedMethods())
app.ws.use(wsRouter.routes())
app.ws.use(wsRouter.allowedMethods())

app.listen(5000)
