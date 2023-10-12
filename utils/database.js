require('dotenv').config()

const { createClient } = require('@supabase/supabase-js')
const Promise = require('bluebird')
const { writeFileSync } = require('fs')
const { flatten, difference, map, keyBy, isEmpty } = require('lodash')
const { deleteImage } = require('./image')

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

const isDevelopment = process.env.NODE_ENV !== 'production'

const makeColorwayKey = (c) => {
    return [
        c.maker_id,
        c.sculpt_id,
        c.colorway_id,
        c.name,
        c.giveaway,
        c.commissioned,
        c.release,
        c.qty,
        c.img,
    ].join()
}

const makeImageId = (c) => `${c.maker_id}-${c.sculpt_id}-${c.colorway_id}`
const makeKeyByOrder = (c) => `${c.maker_id}-${c.sculpt_id}-${c.order}`

const upsert = async (table, data) => {
    const { error } = await supabase.from(table).upsert(data)
    if (error) {
        console.warn(`update table '${table}' error`, data[0].maker_id, error)
    }
}

const getGDocMakers = () =>
    supabase
        .from('makers')
        .select()
        .like('src', '%docs.google.com%')
        .neq('deleted', true)
        .then(({ data }) =>
            data.map((m) => {
                return {
                    id: m.id,
                    document_id: m.src.split('/')[5],
                }
            })
        )

const getColorways = async (maker_id, rows = []) => {
    const { data } = await supabase
        .from('colorways')
        .select()
        .eq('maker_id', maker_id)
        .order('id')
        .range(rows.length, rows.length + 999)

    rows = rows.concat(data)

    if (data.length === 1000) {
        return getColorways(maker_id, rows)
    }

    return rows
}

const insertColorways = async (colorways) => {
    const { data, error } = await supabase.from('colorways').insert(colorways)

    if (error) {
        console.warn('insert new colorways error', error)
    }
}

const updateColorway = async (id, colorway) => {
    const { data, error } = await supabase
        .from('colorways')
        .update(colorway)
        .eq('id', id)

    if (error) {
        console.warn('update new colorway error', id, error)
    }
}

const updateMakerDatabase = async (gdocData) => {
    const { maker_id } = gdocData[0]

    if (isDevelopment) {
        writeFileSync(
            `db/${maker_id}.json`,
            JSON.stringify(gdocData, null, 2),
            () => {
                console.log('done')
            }
        )
    }

    // update sculpts
    const sculpts = gdocData.map(({ colorways, ...rest }) => rest)
    upsert('sculpts', sculpts)

    // update colorways
    const colorways = flatten(map(gdocData, 'colorways'))
    const storedColorways = await getColorways(maker_id)

    const incomingKeys = colorways.map(makeColorwayKey)
    const existedKeys = storedColorways.map(makeColorwayKey)

    const newKeys = difference(incomingKeys, existedKeys)
    const changedKeys = difference(existedKeys, incomingKeys)

    const tobeInserted = colorways.filter((c) =>
        newKeys.includes(makeColorwayKey(c))
    )
    const tobeUpdated = storedColorways.filter((c) =>
        changedKeys.includes(makeColorwayKey(c))
    )

    const insertingMap = keyBy(tobeInserted, makeKeyByOrder)

    const deleteClws = []
    const updateClw = {}

    tobeUpdated.forEach((c) => {
        const key = makeKeyByOrder(c)
        if (insertingMap[key]) {
            const { remote_img, ...rest } = insertingMap[key]
            updateClw[c.id] = rest

            if (c.colorway_id !== rest.colorway_id) {
                deleteClws.push(makeImageId(c))
            }

            delete insertingMap[key]
        } else {
            deleteClws.push(makeImageId(c))
        }
    })

    const insertClws = Object.values(insertingMap).map(
        ({ remote_img, ...rest }) => rest
    )

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

    return colorways
}

module.exports = {
    getGDocMakers,
    makeImageId,
    updateMakerDatabase,
}
