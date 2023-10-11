require('dotenv').config()

const Promise = require('bluebird')
const { writeFileSync } = require('fs')
const { getGDocMakers, updateMaker } = require('./utils/database')
const { downloadDoc } = require('./utils/docs')
const { uploadImage } = require('./utils/image')
const { parser } = require('./utils/parser')

const isDevelopment = process.env.NODE_ENV !== 'production'

const existed = require('./existed_images.json')

async function scan(maker) {
    console.log('start downloading:', maker.id)

    return downloadDoc(maker.document_id)
        .then((jsonDoc) => parser(jsonDoc, maker.id))
        .then(async (data) => {
            if (isDevelopment) {
                writeFileSync(
                    `db/${maker.id}.json`,
                    JSON.stringify(data, null, 2),
                    () => {
                        console.log('done', maker.id)
                    }
                )
            }

            const images = []
            data.forEach((sculpt) => {
                sculpt.colorways.map(async (clw) => {
                    const filename = `${clw.maker_id}-${clw.sculpt_id}-${clw.colorway_id}`
                    if (!existed.includes(filename)) {
                        images.push([filename, clw.remote_img])
                    }
                })
            })

            if (images.length) {
                console.log('updating', images.length)

                await updateMaker(maker.id, data)

                await Promise.map(images, (img) => uploadImage(...img), {
                    concurrency: 5,
                })
            }
        })
        .catch((err) => {
            console.error(
                'catalogue deleted or sth went wrong',
                maker.id,
                err.stack
            )
        })
}

getGDocMakers().then(async (makers) => {
    await Promise.map(makers, scan, { concurrency: 1 })
})
