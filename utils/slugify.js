const slugify = require('slugify').default

exports.urlSlugify = (text) => {
    text = text.replace(/[*+~.()'"!:@,/]/g, '')
    return slugify(text, { lower: true })
}

exports.slugify = (text) => slugify(text, { lower: true })
