const axios = require('axios')
const { removeHtmlTags, getProfileInfo } = require('../utils')
const { urlSlugify } = require('../../utils')

function mapStatus(tags = []) {
    const lowerTags = tags.map((t) => t.toLowerCase())

    if (lowerTags.some((t) => t.includes('preorder'))) return 'Live'

    return null
}

async function fetchKeycaps() {
    const url = 'https://novelkeys.xyz/products.json'
    const response = await axios.get(url)
    const { products } = response.data

    return products
        .filter((p) => p.product_type === 'Keycap Set')
        .map((p) => {
            const { profileId, cleanedName } = getProfileInfo(p.title)
            if (!profileId) return null

            const finalName = cleanedName || p.title
            const slug = urlSlugify(finalName)
            const profile_keycap_id = `${profileId}/${slug}`

            const kits = p.variants.map((v) => ({
                qty: v.inventory_quantity,
                name: v.title,
                price: parseFloat(v.price),
                profile_keycap_id,
                img: v.featured_image?.src ?? null,
            }))

            return {
                keycap: {
                    name: finalName,
                    profile_keycap_id,
                    profile_id: profileId,
                    url: `https://novelkeys.xyz/products/${p.handle}`,
                    description: removeHtmlTags(p.body_html),
                    status: mapStatus(p.tags),
                    review_status: 'Pending',
                    render_img: p.images[0]?.src ?? null,
                    img: p.images[0]?.src ?? null,
                },
                kits,
            }
        })
        .filter(Boolean)
}

module.exports = { name: 'NovelKeys', fetchKeycaps }
