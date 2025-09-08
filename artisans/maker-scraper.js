require('dotenv').config()

const fs = require('fs')
const files = fs.readdirSync('./artisans/makers')
const Promise = require('bluebird')
const { updateMakerDatabase } = require('../utils/database')

function scan(filename) {
    console.log(`🚀 Running specific maker scraper: ${filename}...`)

    const { scraper } = require(`./makers/${filename}`)

    return scraper().then(updateMakerDatabase)
}

Promise.map(files, scan, { concurrency: 1 })
