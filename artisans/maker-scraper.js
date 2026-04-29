require('dotenv').config()

const fs = require('fs')
const files = fs.readdirSync('./artisans/makers')
const Promise = require('bluebird')
const { updateMakerDatabase, setDryRun } = require('./utils/database')

/**
 * List of makers that are known to have incomplete data
 * and should not have missing items removed from the database
 */
const PARTIAL_MAKERS = new Set(['keycat'])

// Check for dry-run flag from command line arguments
const isDryRun = process.argv.includes('--dry-run')
if (isDryRun) {
    console.log('🔄 DRY RUN MODE - Database operations will be logged but not executed')
    setDryRun(true)
}

function scan(filename) {
    console.log(`🚀 Running specific maker scraper: ${filename}...`)

    const { scraper } = require(`./makers/${filename}`)
    const maker_id = filename.replace(/\.js$/, '')

    return scraper().then((tables) =>
        updateMakerDatabase(tables, {
            preserve_missing: PARTIAL_MAKERS.has(maker_id),
        })
    )
}

Promise.map(files, scan, { concurrency: 1 })
