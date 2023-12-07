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
        const data = await Promise.all(
            maker.document_ids.map((docId) =>
                downloadDoc(docId).then((json) => parser(json, maker.id))
            )
        )

        const multi = maker.document_ids.length > 1

        const catalogue = multi ? deepmerge.all(data, { customMerge }) : data[0]

        const database = Object.values(catalogue)

        const { sync, colorways } = await updateMakerDatabase(database)

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
