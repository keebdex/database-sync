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

const makeColorwayKey = (c, withOrder) => {
    const keys = [
        c.maker_id,
        c.sculpt_id,
        c.colorway_id,
        c.name,
        c.sale_type,
        c.release,
        c.qty,
        c.photo_credit,
        c.img,
        c.stem && c.stem.sort().join('-'),
    ]

    if (withOrder) {
        keys.push(c.order)
    }

    return keys.join()
}

const makeKeyByColorwayId = (c) =>
    `${c.maker_id}-${c.sculpt_id}-${c.colorway_id}`
const makeKeyByName = (c) => `${c.maker_id}-${c.sculpt_id}-${c.name}`

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

    const incomingKeys = colorways.map((c) => makeColorwayKey(c, true))
    const existedKeys = storedColorways.map((c) => makeColorwayKey(c, true))

    const newKeys = difference(incomingKeys, existedKeys)
    const changedKeys = difference(existedKeys, incomingKeys)

    const tobeInserted = colorways.filter((c) =>
        newKeys.includes(makeColorwayKey(c, true))
    )
    const tobeUpdated = storedColorways.filter((c) =>
        changedKeys.includes(makeColorwayKey(c, true))
    )

    const insertingMapByColorwayId = keyBy(tobeInserted, makeKeyByColorwayId)
    const insertingMapByName = keyBy(tobeInserted, makeKeyByName)

    const outdatedImages = []
    const updateClw = {}
    const deletedRows = []

    tobeUpdated.forEach((c) => {
        const keyByColorwayId = makeKeyByColorwayId(c)
        const keyByName = makeKeyByName(c)

        if (insertingMapByColorwayId[keyByColorwayId]) {
            // colorway_id/img not changed
            const { remote_img, ...rest } =
                insertingMapByColorwayId[keyByColorwayId]

            updateClw[`${c.id}__${c.colorway_id}`] = rest
            delete insertingMapByColorwayId[keyByColorwayId]
        } else if (insertingMapByName[keyByName]) {
            // name is same, colorway_id/img changed
            const { remote_img, ...rest } = insertingMapByName[keyByName]
            const newKey = makeKeyByColorwayId(rest)

            updateClw[`${c.id}__${c.colorway_id}`] = rest
            delete insertingMapByColorwayId[newKey]

            outdatedImages.push(makeImageId(c))
        } else {
            // colorway deleted, to be removed from the database
            outdatedImages.push(makeImageId(c))
            deletedRows.push(c.id)
        }
    })

    const insertClws = Object.values(insertingMapByColorwayId).map(
        ({ remote_img, ...rest }) => rest
    )

    let modified = false

    if (insertClws.length) {
        modified = true
        await insertRows(colorwayTable, insertClws)

        console.log('colorways inserted', insertClws.length)
    }

    if (!isEmpty(updateClw)) {
        modified = true

        await Promise.map(
            Object.entries(updateClw),
            async ([rowKey, data]) => {
                const [id, old_colorway_id] = rowKey.split('__')
                await updateRow(colorwayTable, id, data)
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
        const outdatedItems = await supabase
            .from('user_collection_items')
            .select('artisan_item_id')
            .in('artisan_item_id', deletedRows)
            .then(({ data }) => data.map((r) => r.artisan_item_id))

        // marked for deletion are added to user collections for later removal
        await Promise.map(
            outdatedItems,
            async (id) => {
                await updateRow(colorwayTable, id, { deleted: true })
            },
            { concurrency: 1 }
        )

        // deleting colorways does not add them to any collections
        await deleteRows(
            colorwayTable,
            'id',
            deletedRows.filter((id) => !outdatedItems.includes(id))
        )

        console.log('colorways deleted', outdatedImages.length)
    }

    return { modified, colorways }
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
