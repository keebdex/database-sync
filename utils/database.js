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
        c.photo_credit,
        c.img,
        c.order,
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
        s.img,
    ].join()
}

const makeImageId = (c) =>
    `artisan/${c.maker_id}/${c.sculpt_id}/${c.colorway_id}`

const makerSculptId = (s) => `${s.maker_id}/${s.sculpt_id}`

const getGDocMakers = () =>
    supabase
        .from('makers')
        .select()
        .neq('deleted', true)
        .then(({ data }) => data.filter((r) => Array.isArray(r.document_ids)))

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

const deleteRows = async (table, column, values) => {
    const { error } = await supabase.from(table).delete().in(column, values)

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

    const insertingMap = keyBy(tobeInserted, makerSculptId)

    const updateSculpt = {}
    const deletedSculpts = []

    /**
     * we dont know it's newly added sculpt or just sculpt name is changed
     * so we accept that and remove old ones
     */
    tobeUpdated.forEach((s) => {
        const key = makerSculptId(s)
        if (insertingMap[key]) {
            updateSculpt[s.id] = insertingMap[key]

            delete insertingMap[key]
        } else {
            deletedSculpts.push(s)
        }
    })

    const newSculpts = Object.values(insertingMap)

    if (newSculpts.length) {
        await insertRows(sculptTable, newSculpts)

        console.log('sculpts inserted', newSculpts.length)
    }

    if (!isEmpty(updateSculpt)) {
        await Promise.map(
            Object.entries(updateSculpt),
            ([id, data]) => updateRow(sculptTable, id, data),
            { concurrency: 1 }
        )

        console.log('sculpts updated', Object.entries(updateSculpt).length)
    }

    // maybe we need to remove colorways which is deleted sculpt
    if (deletedSculpts.length) {
        await deleteRows(
            colorwayTable,
            'maker_sculpt_id',
            deletedSculpts.map(makerSculptId)
        )
        await deleteRows(
            sculptTable,
            'id',
            deletedSculpts.map((s) => s.id)
        )

        console.log('sculpts deleted', deletedSculpts.length)
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
    await updateSculpts(sculpts)

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

    const insertingMap = keyBy(tobeInserted, makeImageId)

    const outdatedImages = []
    const updateClw = {}
    const deletedRows = []

    tobeUpdated.forEach((c) => {
        const key = makeImageId(c)
        if (insertingMap[key]) {
            const { remote_img, ...rest } = insertingMap[key]
            updateClw[`${c.id}__${c.colorway_id}`] = rest

            if (c.colorway_id !== rest.colorway_id) {
                outdatedImages.push(key)
            }

            delete insertingMap[key]
        } else {
            // colorway deleted, to be removed from the database
            outdatedImages.push(key)
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

        console.log('colorways inserted', insertClws.length)
    }

    if (!isEmpty(updateClw)) {
        sync = true

        await Promise.map(
            Object.entries(updateClw),
            async ([rowKey, data]) => {
                const [id, old_colorway_id] = rowKey.split('__')
                await updateRow(colorwayTable, id, data)

                await supabase
                    .from('user_collection_items')
                    .update({
                        colorway_id: data.colorway_id,
                        name: data.name,
                    })
                    .eq('maker_id', data.maker_id)
                    .eq('sculpt_id', data.sculpt_id)
                    .eq('colorway_id', old_colorway_id)
            },
            { concurrency: 1 }
        )

        console.log('colorways updated', Object.entries(updateClw).length)
    }

    if (outdatedImages.length) {
        await Promise.map(outdatedImages, deleteImage, { concurrency: 10 })

        console.log('images pruned', outdatedImages.length)
    }

    if (deletedRows.length) {
        await deleteRows(colorwayTable, 'id', deletedRows)

        console.log('colorways deleted', outdatedImages.length)
    }

    return { sync, colorways }
}

const updateMetadata = async (id, data) => {
    const { error } = await supabase.from('makers').update(data).eq('id', id)

    if (error) {
        console.warn(`update maker error`, id, error)
    }
}

module.exports = {
    getGDocMakers,
    makeImageId,
    updateMakerDatabase,
    updateMetadata,
}
