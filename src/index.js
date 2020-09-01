import Koa from 'koa'
import KoaRouter from '@koa/router'
import websockify from 'koa-websocket'
import { getTweets } from './twitter'
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
          getTweets(ctx, args.keyword)
          break
        case 'close':
          ctx.websocket.close()
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
  ctx.body = 'pong'
})

app.use(router.routes())
app.use(router.allowedMethods())
app.ws.use(wsRouter.routes())
app.ws.use(wsRouter.allowedMethods())

app.listen(5000)
