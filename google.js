require('dotenv').config()

const Promise = require('bluebird')
const deepmerge = require('deepmerge')
const {
    getGDocMakers,
    makeImageId,
    updateMakerDatabase,
} = require('./utils/database')
const { downloadDoc } = require('./utils/docs')
const { uploadImage, getListImages } = require('./utils/image')
const { parser } = require('./utils/parser')

let existedImages = []

async function syncImages({ sync = false, colorways }) {
    // prevent syncing images for staled makers
    if (!sync) return

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

    return Promise.all(
            maker.document_ids.map((docId) =>
                downloadDoc(docId).then((json) => parser(json, maker.id))
            )
        )
        .then(deepmerge.all)
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
