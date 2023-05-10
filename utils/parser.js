const { crc32 } = require('crc')
const { format, parse } = require('date-fns')
const { chunk, flatten, findLast } = require('lodash')
const parse5 = require('parse5')
const { slugify, urlSlugify } = require('./slugify')

const regRelease = /\(([a-zA-Z0-9 ]*\d{4})\)/gim
const jellyReg = /\((\d{2,4}(\/|-)\d{1,2}(\/|-)\d{1,2})\)/gim
const dreadkeysCommission = /\(Commission\)|\(Comission\)/gim

const regQty = /\(count (\d+)\)/gim
const regCommission = /\(\*\)/gim
const regGiveaway = /\(giveaway\)|\(give-away\)/gim

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
        .trim()
}

const parseSculpt = (table, maker_id) => {
    // table.tbody.tr.td
    let [titleNodes, attrNodes] =
        table.childNodes[0]?.childNodes[0]?.childNodes[0].childNodes

    let text = flatten(titleNodes.childNodes.map((cn) => cn.childNodes))
        .map((s) => s.value)
        .join('')
    let subtext = attrNodes
        ? flatten(attrNodes.childNodes.map((cn) => cn.childNodes))
              .map((s) => s.value)
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

    let releaseMatch = regRelease.exec(text) || regRelease.exec(subtext)
    if (releaseMatch) {
        sculpt.release = releaseMatch[1]
        text = text.replace(regRelease, '')
    }

    if (maker_id === 'jelly-key') {
        const dateMatch = jellyReg.exec(text)
        if (dateMatch) {
            sculpt.release = format(
                parse(dateMatch[1], 'yyyy/M/d', new Date()),
                'dd MMM yyyy'
            )
            text = text.replace(jellyReg, '')
        }
    }

    Object.entries(attrs).forEach(([attr, obj]) => {
        Object.entries(obj).forEach(([key, value]) => {
            if (subtext.includes(value)) {
                sculpt[attr] = key
                subtext = subtext.replace(value, '')
            }
        })
    })

    sculpt.name = normalize(text)
    sculpt.sculpt_id = urlSlugify(sculpt.name)

    return sculpt
}

const parser = (html, maker_id) => {
    const document = parse5.parse(html)

    const body = document.childNodes[0].childNodes.find(
        (n) => n.nodeName === 'body'
    )

    let tables = body.childNodes.filter(
        (n) => n.nodeName === 'table' && n.tagName === 'table'
    )

    const chunks = chunk(tables, 2)
    const sculpts = chunks.map((chunk) => {
        if (chunk.length === 1) {
            return null
        }

        const sculpt = parseSculpt(chunk[0], maker_id)

        const cells = flatten(
            chunk[1].childNodes[0].childNodes.map((n) => n.childNodes)
        )

        const colorways = []
        cells.forEach((cell, order) => {
            const colorway = {
                name: '',
                sculpt_id: sculpt.sculpt_id,
                maker_id,
                giveaway: false,
                commissioned: false,
                release: null,
                qty: null,
                order,
            }

            const texts = []

            // td.span
            cell.childNodes.forEach((n) => {
                const nodes = flatten(n.childNodes.map((cn) => cn.childNodes))
                nodes.forEach((cn) => {
                    switch (cn.nodeName) {
                        case 'img':
                            const attr = cn.attrs.find((a) => a.name === 'src')
                            if (attr) {
                                colorway.img = attr.value
                            }
                            break
                        case '#text':
                            texts.push(cn.value)
                            break
                        default:
                            break
                    }
                })
            })

            let text = texts.join(' ')

            const releaseMatch = regRelease.exec(text)
            if (releaseMatch) {
                colorway.release = releaseMatch[1]
                text = text.replace(regRelease, '')
            }

            const qtyMatch = regQty.exec(text)
            if (qtyMatch) {
                colorway.qty = Number(qtyMatch[1])
                text = text.replace(regQty, '')
            }

            const commissionMatch = regCommission.exec(text)
            if (commissionMatch) {
                colorway.commissioned = true
                text = text.replace(regCommission, '')
            }

            const giveawayMatch = regGiveaway.exec(text)
            if (giveawayMatch) {
                colorway.giveaway = true
                text = text.replace(regGiveaway, '')
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
                        .replace('  ', '')
                }
            }

            if (maker_id === 'keycat') {
                if (text.includes('(GB)')) {
                    text = text.replace('(GB)', '')
                }
            }

            if (maker_id === 'dreadkeys') {
                const isCommission = dreadkeysCommission.exec(text)
                if (isCommission) {
                    colorway.commissioned = true
                    text = text.replace(dreadkeysCommission, '')
                }
            }

            colorway.name = normalize(text)

            const slug = slugify(colorway.name)

            colorway.colorway_id = crc32(
                `${maker_id}-${sculpt.sculpt_id}-${slug}-${order}`
            ).toString(16)

            colorways.push(colorway)
        })

        sculpt.colorways = colorways.filter((c) => c.img)
        const last = findLast(sculpt.colorways)
        if (last) {
            sculpt.img = last.img
        }

        return sculpt
    })

    return sculpts.filter(s => s && s.name && s.colorways.length)
}

module.exports = { parser }
