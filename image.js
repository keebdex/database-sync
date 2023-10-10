const fs = require('fs')
const { getListImages } = require('./utils/image')

getListImages().then((images) => {
    fs.writeFileSync('existed_images.json', JSON.stringify(images), () => {
        console.log('done')
    })
})
