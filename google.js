require('dotenv').config()

const Promise = require('bluebird')
const deepmerge = require('deepmerge')
const {
    getGDocMakers,
    makeImageId,
    updateMakerDatabase,
    updateMetadata,
} = require('./utils/database')
const { downloadDoc, getFile } = require('./utils/docs')
const { uploadImage, getListImages } = require('./utils/image')
const { parser } = require('./utils/parser')
const { findLast } = require('lodash')

let existedImages = []

function customMerge(key) {
    if (key === 'colorways') {
        /**
         * this custom function to keep the colorway order is continuing
         * but the order for colorways from the second doc will be changed
         * if the maintainer added new colorways into the end of the first doc
         */
        return (prev, curr) => {
            const length = prev.length
            curr.forEach((c) => {
                c.order = c.order + length + 1
            })

            return prev.concat(curr)
        }
    }
}

async function scan(maker) {
    console.log('start downloading:', maker.id)

    try {
        const files = await Promise.all(maker.document_ids.map(downloadDoc))

        const multi = maker.document_ids.length > 1

        const documents = files.map((file) => parser(file, maker.id))
        const catalogue = multi
            ? deepmerge.all(documents, { customMerge })
            : documents[0]

        const database = Object.values(catalogue)

        const { sync, colorways } = await updateMakerDatabase(database)

        if (!sync) return

        const metadata = await getFile(findLast(maker.document_ids))

        await updateMetadata(maker.id, metadata)

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
    } catch (error) {
        console.error(
            'catalogue deleted or sth went wrong',
            maker.id,
            error.stack
        )
    }
}

getGDocMakers().then(async (makers) => {
    existedImages = await getListImages()

    console.log('existed images', existedImages.length)

    await Promise.map(makers, scan, { concurrency: 1 })
})
