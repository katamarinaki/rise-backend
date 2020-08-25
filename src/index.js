import Koa from 'koa'
import KoaRouter from '@koa/router'
import websockify from 'koa-websocket'
import { Twitter } from './twitter'
import { get } from 'lodash'

const app = websockify(new Koa())
const router = new KoaRouter()

// {"command": "getTweets", "args": {"q": "from:Katamarinaki", "count": "10"}}
router.all('/twitter', async (ctx) => {
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
            count: parseInt(args.count),
          }).then((d) => {
            ctx.websocket.send(JSON.stringify(d.data))
          })
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

app.ws.use(router.routes())
app.ws.use(router.allowedMethods())

app.listen(5000)
