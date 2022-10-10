const { format, parse } = require('date-fns')
const { get, chunk, flatten } = require('lodash')
const parse5 = require('parse5')
const slugify = require('slugify').default

const regRelease = /\(([a-zA-Z ]*\d{4})\)/gim
const jellyReg = /\((\d{4}\/[01]\d\/[0-3]\d)\)/gim

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

const parseSculpt = (table, maker_id) => {
    // table.tbody.tr.td
    let text = table.childNodes[0]?.childNodes[0]?.childNodes[0].childNodes
        .map((n) => n.childNodes[0]?.childNodes[0]?.value)
        .join(' ')

    const sculpt = {}

    const releaseMatch = regRelease.exec(text)
    if (releaseMatch) {
        sculpt.release = releaseMatch[1]
        text = text.replace(regRelease, '')
    }

    if (maker_id === 'jelly-key') {
        const dateMatch = jellyReg.exec(text)
        if (dateMatch) {
            sculpt.release = format(
                parse(dateMatch[1], 'yyyy/MM/dd', new Date()),
                'dd MMM yyyy'
            )
            text = text.replace(jellyReg, '')
        }
    }

    Object.entries(attrs).forEach(([attr, obj]) => {
        Object.entries(obj).forEach(([key, value]) => {
            if (text.includes(value)) {
                sculpt[attr] = key
                text = text.replace(value, '')
            }
        })
    })

    sculpt.name = text.trim()
    sculpt.sculpt_id = slugify(sculpt.name, { lower: true })

    return sculpt
}

const parser = (html, maker_id) => {
    const document = parse5.parse(html)

    const body = document.childNodes[0].childNodes.find(
        (n) => n.nodeName === 'body'
    )

    const tables = body.childNodes.filter(
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
        cells.forEach((cell) => {
            const colorway = {
                name: '',
                sculpt_id: sculpt.sculpt_id,
                maker_id,
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

            colorway.name = text.trim()

            colorways.push(colorway)
        })

        sculpt.colorways = colorways.filter((c) => c.img)

        return sculpt
    })

    return sculpts.filter((s) => !!s)
}

module.exports = { parser }
