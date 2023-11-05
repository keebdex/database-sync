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

const sculptTable = 'sculpts'
const colorwayTable = 'colorways'

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

const makeSculptKey = (s) => {
    return [
        s.maker_id,
        s.sculpt_id,
        s.release,
        s.profile,
        s.cast,
        s.design,
    ].join()
}

const makeImageId = (c) => `${c.maker_id}-${c.sculpt_id}-${c.colorway_id}`
const makeKeyByOrder = (c) => `${c.maker_id}-${c.sculpt_id}-${c.order}`

const makeSculptId = (s) => `${s.maker_id}-${s.sculpt_id}`

const getGDocMakers = () =>
    supabase
        .from('makers')
        .select()
        .like('src', '%docs.google.com%')
        .neq('deleted', true)
        .in('id', ['mubai'])
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

const insertRows = async (table, values) => {
    const { error } = await supabase.from(table).insert(values)

    if (error) {
        console.warn(`insert new ${table} error`, error)
    }
}

const deleteRows = async (table, ids) => {
    const { error } = await supabase.from(table).delete().in('id', ids)

    if (error) {
        console.warn(`delete old ${table} error`, error)
    }
}

const updateRow = async (table, id, values) => {
    const { error } = await supabase.from(table).update(values).eq('id', id)

    if (error) {
        console.warn(`update ${table} row error`, id, error)
    }
}

const updateSculpts = async (sculpts) => {
    const { data: storedSculpts } = await supabase
        .from('sculpts')
        .select()
        .eq('maker_id', sculpts[0].maker_id)

    const incomingKeys = sculpts.map(makeSculptKey)
    const existedKeys = storedSculpts.map(makeSculptKey)

    const newKeys = difference(incomingKeys, existedKeys)
    const changedKeys = difference(existedKeys, incomingKeys)

    const tobeInserted = sculpts.filter((s) =>
        newKeys.includes(makeSculptKey(s))
    )
    const tobeUpdated = storedSculpts.filter((s) =>
        changedKeys.includes(makeSculptKey(s))
    )

    const insertingMap = keyBy(tobeInserted, makeSculptId)

    const updateSculpt = {}
    const deletedSculpts = []

    /**
     * we dont know it's newly added sculpt or just sculpt name is changed
     * so we accept that and remove old ones
     */
    tobeUpdated.forEach((s) => {
        const key = makeSculptId(s)
        if (insertingMap[key]) {
            updateSculpt[s.id] = insertingMap[key]

            delete insertingMap[key]
        } else {
            deletedSculpts.push(s.id)
        }
    })

    const newSculpts = Object.values(insertingMap)

    if (newSculpts.length) {
        await insertRows(sculptTable, newSculpts)

        console.log('inserted', newSculpts.length)
    }

    if (!isEmpty(updateSculpt)) {
        await Promise.map(
            Object.entries(updateSculpt),
            ([id, data]) => updateRow(sculptTable, id, data),
            { concurrency: 1 }
        )

        console.log('updated', Object.entries(updateSculpt).length)
    }

    // maybe we need to remove colorways which is deleted sculpt
    if (deletedSculpts.length) {
        await deleteRows(sculptTable, deletedSculpts)

        console.log('deleted', deletedSculpts.length)
    }
}

const updateMakerDatabase = async (tables) => {
    const { maker_id } = tables[0]

    if (isDevelopment) {
        writeFileSync(
            `db/${maker_id}.json`,
            JSON.stringify(tables, null, 2),
            () => {
                console.log('done')
            }
        )
    }

    // update sculpts
    const sculpts = tables.map(({ colorways, ...rest }) => rest)
    updateSculpts(sculpts)

    // update colorways
    const colorways = flatten(map(tables, 'colorways'))
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

    const outdatedImages = []
    const updateClw = {}
    const deletedRows = []

    tobeUpdated.forEach((c) => {
        const key = makeKeyByOrder(c)
        if (insertingMap[key]) {
            const { remote_img, ...rest } = insertingMap[key]
            updateClw[c.id] = rest

            if (c.colorway_id !== rest.colorway_id) {
                outdatedImages.push(makeImageId(c))
            }

            delete insertingMap[key]
        } else {
            // colorway deleted, to be removed from the database
            outdatedImages.push(makeImageId(c))
            deletedRows.push(c.id)
        }
    })

    const insertClws = Object.values(insertingMap).map(
        ({ remote_img, ...rest }) => rest
    )

    let sync = false

    if (insertClws.length) {
        sync = true
        await insertRows(colorwayTable, insertClws)

        console.log('inserted', insertClws.length)
    }

    if (!isEmpty(updateClw)) {
        sync = true

        await Promise.map(
            Object.entries(updateClw),
            ([id, data]) => updateRow(colorwayTable, id, data),
            { concurrency: 1 }
        )

        console.log('updated', Object.entries(updateClw).length)
    }

    if (outdatedImages.length) {
        await Promise.map(outdatedImages, deleteImage, { concurrency: 10 })

        console.log('images pruned', outdatedImages.length)
    }

    if (deletedRows.length) {
        await deleteRows(colorwayTable, deletedRows)

        console.log('deleted', outdatedImages.length)
    }

    return { sync, colorways }
}

module.exports = {
    getGDocMakers,
    makeImageId,
    updateMakerDatabase,
}
