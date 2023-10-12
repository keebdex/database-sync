require('dotenv').config()

const Promise = require('bluebird')
const { getGDocMakers, makeImageId, updateMakerDatabase } = require('./utils/database')
const { downloadDoc } = require('./utils/docs')
const { uploadImage, getListImages } = require('./utils/image')
const { parser } = require('./utils/parser')

let existedImages = []

async function syncImages(colorways) {
    const images = []
    colorways.map((clw) => {
        const filename = makeImageId(clw)
        if (!existedImages.includes(filename)) {
            images.push([filename, clw.remote_img])
        }
    })

    if (images.length) {
        console.log('syncing images', images.length)

        await Promise.map(images, (img) => uploadImage(...img), {
            concurrency: 5,
        })
    }
}

async function scan(maker) {
    console.log('start downloading:', maker.id)

    return downloadDoc(maker.document_id)
        .then((jsonDoc) => parser(jsonDoc, maker.id))
        .then(updateMakerDatabase)
        .then(syncImages)
        .catch((err) => {
            console.error(
                'catalogue deleted or sth went wrong',
                maker.id,
                err.stack
            )
        })
}

getGDocMakers().then(async (makers) => {
    existedImages = await getListImages()

    console.log('existed images', existedImages.length)

    await Promise.map(makers, scan, { concurrency: 1 })
})
