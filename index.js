require('dotenv').config()

const { writeFileSync } = require('fs')
const { getGDocMakers, updateDatabase } = require('./utils/database')
const { downloader } = require('./utils/docs')
const { parser } = require('./utils/parser')

const isDevelopment = process.env.NODE_ENV !== 'production'

getGDocMakers().then((makers) => {
    makers.forEach((maker) => {
        console.log('start downloading:', maker.id)

        downloader(maker.document_id)
            .then((html) => parser(html, maker.id))
            .then((data) => {
                if (isDevelopment) {
                    writeFileSync(
                        `db/${maker.id}.json`,
                        JSON.stringify(data, null, 2),
                        () => {
                            console.log('done', maker.id)
                        }
                    )
                }

                updateDatabase(maker.id, data)
            })
            .catch((err) => {
                console.error(
                    'catalogue deleted or sth went wrong',
                    maker.id,
                    err.message
                )
            })
    })
})
