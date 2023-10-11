require('dotenv').config()

const Promise = require('bluebird')
const { writeFileSync } = require('fs')
const { flatten, difference, map, keyBy, isEmpty } = require('lodash')
const {
    getGDocMakers,
    getColorways,
    insertColorways,
    updateColorway,
} = require('./utils/database')
const { downloadDoc } = require('./utils/docs')
const { uploadImage, getListImages, deleteImage } = require('./utils/image')
const { parser } = require('./utils/parser')

const clwKey = (c) => `${c.maker_id}-${c.sculpt_id}-${c.colorway_id}`
const orderKey = (c) => `${c.maker_id}-${c.sculpt_id}-${c.order}`

let existedImages = []

async function syncDatabase(gdocData) {
    const { maker_id } = gdocData[0]

    writeFileSync(
        `db/${maker_id}.json`,
        JSON.stringify(gdocData, null, 2),
        () => {
            console.log('done')
        }
    )

    const colorways = flatten(map(gdocData, 'colorways'))

    const storedColorways = await getColorways(maker_id)

    const incomingKeys = colorways.map(clwKey)
    const existedKeys = storedColorways.map(clwKey)

    const newKeys = difference(incomingKeys, existedKeys)
    const changedKeys = difference(existedKeys, incomingKeys)

    const tobeInserted = colorways.filter((c) => newKeys.includes(clwKey(c)))
    const tobeUpdated = storedColorways.filter((c) =>
        changedKeys.includes(clwKey(c))
    )

    const insertingMap = keyBy(tobeInserted, orderKey)

    const deleteClws = []
    const updateClw = {}

    tobeUpdated.forEach((c) => {
        const key = orderKey(c)
        if (insertingMap[key]) {
            updateClw[c.id] = insertingMap[key]

            delete insertingMap[key]
        }

        deleteClws.push(clwKey(c))
    })

    const insertClws = Object.values(insertingMap)

    if (insertClws.length) {
        await insertColorways(insertClws)
        console.log('inserted', insertClws.length)
    }

    if (!isEmpty(updateClw)) {
        await Promise.map(
            Object.entries(updateClw),
            ([id, data]) => updateColorway(id, data),
            { concurrency: 1 }
        )

        console.log('updated', Object.entries(updateClw).length)
    }

    if (deleteClws.length) {
        await Promise.map(deleteClws, deleteImage, { concurrency: 10 })

        console.log('deleted images', deleteClws.length)
    }

    /**
     * FIXME
     * How we can update extra data like: release, qty
     * How we can prune changed/removed images
     */

    return colorways
}

async function syncImages(colorways) {
    const images = []
    colorways.map((clw) => {
        const filename = `${clw.maker_id}-${clw.sculpt_id}-${clw.colorway_id}`
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
        .then(syncDatabase)
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
