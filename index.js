require('dotenv').config()

const { downloader } = require('./utils/docs')
const { parser } = require('./utils/parser')

const maker = {
    id: 'artkey',
    docId: '1piD-uC3eAwy0dkqxnsZoYr_-AnezmelpFnHfuK3RslM',
}

downloader(maker.docId)
    .then((html) => parser(html, maker.id))
    .then((data) => {
        require('fs').writeFileSync(
            `${maker.id}.json`,
            JSON.stringify(data, null, 2),
            () => {
                console.log('done', maker.id)
            }
        )
    })
