const { format, parse } = require('date-fns')
const { chunk, flatten, findLast, get, keyBy } = require('lodash')
const { urlSlugify } = require('./slugify')

const regex = {
    artisan_keycap: /artisan keycaps|artisan keycap/gim,
    commission_dreadkeys: /\(commission\)|\(comission\)/gim,
    commission: /\(\*\)/gim,
    giveaway: /\(giveaway\)|\(give-away\)|\(discord giveaway\)/gim,
    oneoff: /\(oneoff\)|\(one-off\)|\(1\/1\)/gim,
    photo_credit: /\(pc (.*)\)/gim,
    qty: /\(count (\d+)\)/gim,
    release_jelly_key: /\((\d{2,4}(\/|-)\d{1,2}(\/|-)\d{1,2})\)/gim,
    release: /\(([a-zA-Z0-9 ]*\d{4})\)/gim,
    stem: /\(stemtype\s+((?:topre|mx|alps|tmx|choc|bs)(?:\s+(?:topre|mx|alps|tmx|choc|bs))*)\b\)/gim,
    stem_sculpt: /\((topre|mx|alps|tmx|choc|bs)\)/gim,
}

const stemMap = {
    topre: 'Topre',
    mx: 'MX',
    alps: 'Alps',
    tmx: 'TMX',
    choc: 'Choc',
    bs: 'BS',
}

const attrs = {
    profile: {
        sculpted: '(ka_profile_sculpt)',
        blank: '(ka_profile_blank)',
    },
    design: {
        physical: '(ka_design_physical)',
        digital: '(ka_design_digital)',
        hybrid: '(ka_design_hybrid)',
    },
    cast: {
        resin: '(ka_cast_resin)',
        mixed: '(ka_cast_mixed)',
    },
}

const normalize = (text) => {
    return text
        .replace('(ka_cover)', '')
        .replace(/(“|”)/g, '"')
        .replace(/(‘|’)/g, "'")
        .replace(/\u200e/g, '') // cysm sculpt name
        .replace(/\u200f/g, '') // cysm sculpt name
        .replace(/\u200b/g, '') // cysm sculpt name
        .replaceAll('  ', ' ')
        .trim()
}

const normalizeDate = (text) => {
    try {
        return format(parse(text, 'MMMM yyyy', new Date()), 'MMM yyyy')
    } catch (error) {
        return text
    }
}

const normalizeStem = (text) =>
    stemMap[text.toLowerCase()] || text.toLowerCase()

const parseSculpt = (table, maker_id) => {
    let [titleNodes, attrNodes] = table.table.tableRows[0].tableCells[0].content

    let text = titleNodes.paragraph.elements
        .map((s) => s.textRun.content.trim())
        .join('')
    let subtext = attrNodes
        ? attrNodes.paragraph.elements
              .map((s) => s.textRun.content)
              .join('')
              .toLowerCase()
        : ''

    const sculpt = {
        maker_id,
        release: null,
        design: null,
        profile: null,
        cast: null,
        img: null,
    }

    let releaseMatch = regex.release.exec(text) || regex.release.exec(subtext)
    if (releaseMatch) {
        sculpt.release = normalizeDate(releaseMatch[1].trim())
        text = text.replace(regex.release, '')
    }

    if (maker_id === 'jelly-key') {
        const dateMatch = regex.release_jelly_key.exec(text)
        if (dateMatch) {
            try {
                sculpt.release = format(
                    parse(dateMatch[1], 'yyyy/M/d', new Date()),
                    'dd MMM yyyy'
                )
            } catch (error) {
                sculpt.release = format(
                    parse(dateMatch[1], 'yyyy/d/M', new Date()),
                    'dd MMM yyyy'
                )
            }
            text = text.replace(regex.release_jelly_key, '')
        }

        const endsWith = regex.artisan_keycap.exec(text)
        if (endsWith) {
            text = text.replace(regex.artisan_keycap, '')
        }
    }

    Object.entries(attrs).forEach(([attr, obj]) => {
        Object.entries(obj).forEach(([key, value]) => {
            if (subtext.includes(value)) {
                sculpt[attr] = key
                subtext = subtext.replace(value, '')
            }
            if (text.includes(value)) {
                sculpt[attr] = key
                text = text.replace(value, '')
            }
        })
    })

    // try parse stem from the sculpt name and assign to all colorways
    let stem = null
    const stemMatch = regex.stem_sculpt.exec(text)
    if (stemMatch) {
        stem = [normalizeStem(stemMatch[1])]
        text = text.replace(regex.stem_sculpt, '')
    }

    sculpt.name = normalize(text)
    sculpt.sculpt_id = urlSlugify(sculpt.name)

    return { sculpt, stem }
}

const parseColorways = (table, document, maker_id, sculpt, stem) => {
    const colorways = []

    const cells = flatten(table.table.tableRows.map((r) => r.tableCells))

    cells.forEach((cell, order) => {
        const elements = flatten(cell.content.map((c) => c.paragraph.elements))

        const colorway = {
            name: '',
            sculpt_id: sculpt.sculpt_id,
            maker_id,
            giveaway: false,
            commissioned: false,
            release: null,
            qty: null,
            photo_credit: null,
            stem,
            order,
        }

        const texts = []
        elements.forEach((element) => {
            if (element?.textRun?.content) {
                texts.push(element.textRun.content.trim())
            }

            if (element?.inlineObjectElement?.inlineObjectId) {
                const obj =
                    document.inlineObjects[
                        element.inlineObjectElement.inlineObjectId
                    ]
                const img = get(
                    obj,
                    'inlineObjectProperties.embeddedObject.imageProperties.contentUri'
                )

                colorway.remote_img = img
                colorway.colorway_id = obj.objectId
                colorway.img = `https://imagedelivery.net/${process.env.CF_IMAGES_ACCOUNT_HASH}/artisan/${maker_id}/${sculpt.sculpt_id}/${obj.objectId}/public`
            }
        })

        let text = texts.join(' ')

        const releaseMatch = regex.release.exec(text)
        if (releaseMatch) {
            colorway.release = normalizeDate(releaseMatch[1].trim())
            text = text.replace(regex.release, '')
        }

        const qtyMatch = regex.qty.exec(text)
        if (qtyMatch) {
            colorway.qty = Number(qtyMatch[1])
            text = text.replace(regex.qty, '')
        }

        const oneoffMatch = regex.oneoff.exec(text)
        if (oneoffMatch) {
            colorway.qty = 1
            text = text.replace(regex.oneoff, '')
        }

        const commissionMatch = regex.commission.exec(text)
        if (commissionMatch) {
            colorway.commissioned = true
            text = text.replace(regex.commission, '')
        }

        const giveawayMatch = regex.giveaway.exec(text)
        if (giveawayMatch) {
            colorway.giveaway = true
            text = text.replace(regex.giveaway, '')
        }

        const photoCreditMatch = regex.photo_credit.exec(text)
        if (photoCreditMatch) {
            colorway.photo_credit = photoCreditMatch[1]
            text = text.replace(regex.photo_credit, '')
        }

        const stemMatch = regex.stem.exec(text)
        if (stemMatch) {
            const stemTypes = stemMatch[1].split(' ')
            colorway.stem = stemTypes.map(normalizeStem)
            text = text.replace(regex.stem, '')
        }

        if (maker_id === 'fraktal-kaps') {
            if (text.includes('°')) {
                colorway.commissioned = true
                text = text.replace('°', '')
            }
            if (text.includes('*')) {
                colorway.qty = 1
                text = text.replace('*', '')
            }
        }

        if (maker_id === 'hello-caps') {
            if (text.includes('*')) {
                colorway.commissioned = true
                text = text
                    .replace('( * )', '')
                    .replace('*', '')
                    .replace('  ', ' ')
            }
        }

        if (maker_id === 'keycat') {
            if (text.includes('(GB)')) {
                text = text.replace('(GB)', '')
            }
        }

        if (maker_id === 'dreadkeys') {
            const isCommission = regex.commission_dreadkeys.exec(text)
            if (isCommission) {
                colorway.commissioned = true
                text = text.replace(regex.commission_dreadkeys, '')
            }
        }

        colorway.name = normalize(text)

        colorways.push(colorway)
    })

    return colorways
}

const parser = (document, maker_id) => {
    const tables = document.body.content.filter((b) => b.table)

    const chunks = chunk(tables, 2)
    const sculpts = chunks.map((chunk, index) => {
        if (chunk.length === 1) return null

        try {
            const { sculpt, stem } = parseSculpt(chunk[0], maker_id)
            const colorways = parseColorways(
                chunk[1],
                document,
                maker_id,
                sculpt,
                stem
            )

            sculpt.colorways = colorways.filter((c) => c.img)
            const last = findLast(sculpt.colorways)
            if (last) {
                sculpt.img = last.img
            }

            return sculpt
        } catch (error) {
            console.log('parse sculpt is broken at index', index)
            throw error
        }
    })

    return keyBy(
        sculpts.filter((s) => s && s.name && s.colorways.length),
        (s) => `${s.maker_id}/${s.sculpt_id}`
    )
}

module.exports = { parser }
