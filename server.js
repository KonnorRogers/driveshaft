import express, { Router } from "express"
import bodyParser from "body-parser"
// will be used for testing files.
import multer from "multer"
import * as path from "node:path"
import * as url from "node:url"
import fs from "fs"

async function start () {
  const { json, urlencoded } = bodyParser
  const router = Router()
  router.use(multer().none())

  const app = express()
  app.use(json({ limit: "1mb" }), urlencoded({ extended: true }))
  app.use(express.static("."))
  app.use(express.static("./fixtures"))

  const port = parseInt(process.env.PORT || "9000")

  app.listen(port, () => {
    console.log(`Test server listening on port ${port}`)
  })
}

await start()
