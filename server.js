import express, { Router } from "express"
import bodyParser from "body-parser"
// will be used for testing files.
import multer from "multer"
import * as path from "node:path"
import * as url from "node:url"
import fs from "fs"
import WebSocket, { WebSocketServer } from 'ws';
import chokidar from 'chokidar';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

async function start () {
  const { json, urlencoded } = bodyParser
  const router = Router()
  router.use(multer().none())

  const app = express()

  const websocketServer = new WebSocketServer({
    port: 8080,
  })


  function reload() {
    websocketServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("reload");
      }
    });
  }


  function heartbeat() {
    clearTimeout(this.pingTimeout);

    // Use `WebSocket#terminate()`, which immediately destroys the connection,
    // instead of `WebSocket#close()`, which waits for the close timer.
    // Delay should be equal to the interval at which your server
    // sends out pings plus a conservative assumption of the latency.
    this.pingTimeout = setTimeout(() => {
      this.terminate();
    }, 30000 + 1000);
  }

  websocketServer.on('error', console.error);
  websocketServer.on('open', heartbeat);
  websocketServer.on('ping', heartbeat);
  websocketServer.on('close', function clear() {
    clearTimeout(this.pingTimeout);
  });

  chokidar.watch(__dirname, {
    persistent: true,
    awaitWriteFinish: true, // emit single event when chunked writes are completed
    atomic: true, // emit proper events when "atomic writes" (mv _tmp file) are used
    interval: 100,
    binaryInterval: 100,
    // ignoreInitial: true,
  })
    .on("add", reload)
    .on("change", reload)
    .on("unlink", reload)


  app.set('view engine', 'ejs')
  // Specify the directory where your EJS template files are located
  app.set('views', path.join(__dirname, 'server', 'views'));

  app.get("/{index.html}", (req, res, next) => {
    res.render("index.html.ejs")
  })

  app.post("/redirect-external", (req, res, next) => {
    res.redirect(303, "https://example.com")
  })

  app.post("/redirect-internal", (req, res, next) => {
    res.redirect(303, "/index.html")
  })

  app.get("/page-2.html", (req, res, next) => {
    res.render("page-2.html.ejs")
  })

  app.use(json({ limit: "1mb" }), urlencoded({ extended: true }))
  app.use(express.static("."))
  app.use(express.static("./server/public"))

  const port = parseInt(process.env.PORT || "9000")

  app.listen(port, () => {
    console.log(`Test server listening on port ${port}`)
  })
}

await start()
