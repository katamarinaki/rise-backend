import Koa from 'koa'
import KoaRouter from '@koa/router'
import websockify from 'koa-websocket'

const app = websockify(new Koa())
const router = new KoaRouter()

router.all('/test/', async (ctx) => {
  ctx.websocket.send('Hello World')
  ctx.websocket.on('message', function (message) {
    console.log(message)
  })
})

app.ws.use(router.routes())
app.ws.use(router.allowedMethods())

app.listen(3000)
