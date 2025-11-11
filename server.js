import express, { Router } from "express"
import bodyParser from "body-parser"
// will be used for testing files.
import multer from "multer"
import * as path from "node:path"
import * as url from "node:url"
import fs from "fs"

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));


async function start () {
  const { json, urlencoded } = bodyParser
  const router = Router()
  router.use(multer().none())

  const app = express()

  app.set('view engine', 'ejs')
  // Specify the directory where your EJS template files are located
  app.set('views', path.join(__dirname, 'server', 'views'));

  app.get("/{index.html}", (req, res, next) => {
    res.render("index.ejs.html")
  })

  app.get("/page-2.html", (req, res, next) => {
    res.render("page-2.ejs.html")
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
