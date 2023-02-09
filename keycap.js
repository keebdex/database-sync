const dir = '/Users/anhthang/Downloads/matrixzj.github.io-master/rawdata'

const fs = require('fs')
const ini = require('ini')
const { default: slugify } = require('slugify')

const profiles = ['gmk', 'sa']

const keysets = []
profiles.forEach((profile) => {
    const files = fs.readdirSync(`${dir}/${profile}`)
    files.forEach((file) => {
        const raw = fs.readFileSync(`${dir}/${profile}/${file}`)
        let info
        try {
            info = JSON.parse(raw)
        } catch (error) {
            let initxt = raw.toString()
            if (initxt.startsWith('name:')) {
                initxt = initxt.replaceAll(":'", "='")
            }

            info = ini.parse(initxt)
        }

        if (info.name) {
            keysets.push(info)
        } else {
            console.warn('no name', file)
        }
    })
})

const parsedKeysets = []
const kits = []

keysets.forEach((info) => {
    const slug = `${info.keycapstype.toLowerCase()}/${slugify(
        String(info.name),
        {
            lower: true,
        }
    )}`
    const [start, end] = info.time.split(' ~ ')

    parsedKeysets.push({
        name: info.name,
        slug,
        designer: info.designer,
        manufacture: info.keycapstype.toLowerCase(),
        // base: info.base,
        // legend: info.legend,
        profile: info.profile,
        img: Array.isArray(info.render_pics) ? info.render_pics[0] : '',
        url: info.link,
        history_graph: info.history_graph,
        order_graph: info.order_graph,
        start,
        end,
    })

    if (Array.isArray(info.price_list)) {
        info.price_list.forEach((kit) => {
            const isCancelled =
                kit.quantity === 'Canceled' || kit.quantity === 'Cancelled'
            kits.push({
                name: kit.name,
                price: kit.price,
                img: kit.pic,
                qty: isCancelled ? '' : kit.quantity,
                status: isCancelled ? kit.quantity : '',
                keyset_id: slug,
            })
        })
    }
})

fs.writeFileSync(
    'keycaps_2.json',
    JSON.stringify(parsedKeysets, null, 2),
    () => {
        console.log('done')
    }
)

fs.writeFileSync('kits_2.json', JSON.stringify(kits, null, 2), () => {
    console.log('done')
})
