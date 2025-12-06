require('dotenv').config()

const fs = require('fs')
const files = fs.readdirSync('./artisans/makers')
const Promise = require('bluebird')
const { updateMakerDatabase, setDryRun } = require('./utils/database')

// Check for dry-run flag from command line arguments
const isDryRun = process.argv.includes('--dry-run')
if (isDryRun) {
    console.log('🔄 DRY RUN MODE - Database operations will be logged but not executed')
    setDryRun(true)
}

function scan(filename) {
    console.log(`🚀 Running specific maker scraper: ${filename}...`)

    const { scraper } = require(`./makers/${filename}`)

    return scraper().then(updateMakerDatabase)
}

Promise.map(files, scan, { concurrency: 1 })
