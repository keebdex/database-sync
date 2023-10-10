require('dotenv').config()

const { writeFileSync } = require('fs')
const { getGDocMakers, updateMaker } = require('./utils/database')
const { downloadDoc } = require('./utils/docs')
const { uploadImage } = require('./utils/image')
const { parser } = require('./utils/parser')

const isDevelopment = process.env.NODE_ENV !== 'production'

getGDocMakers().then((makers) => {
    makers.forEach((maker, idx) => {
        setTimeout(() => {
            console.log('start downloading:', maker.id)

            downloadDoc(maker.document_id)
                .then((jsonDoc) => parser(jsonDoc, maker.id))
                .then((data) => {
                    if (isDevelopment) {
                        writeFileSync(
                            `db/${maker.id}.json`,
                            JSON.stringify(data, null, 2),
                            () => {
                                console.log('done', maker.id)
                            }
                        )

                        data.forEach((sculpt) => {
                            sculpt.colorways.map(async (clw) => {
                                await uploadImage(clw.remote_img, clw.object_id)
                            })
                        })
                    }

                    updateMaker(maker.id, data)
                })
                .catch((err) => {
                    console.error(
                        'catalogue deleted or sth went wrong',
                        maker.id,
                        err.stack
                    )
                })
        }, idx * 1000)
    })
})
