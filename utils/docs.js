const docs = require('@googleapis/docs')
const drive = require('@googleapis/drive')
const path = require('path')

const downloadDoc = async (documentId) => {
    const auth = new docs.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/documents'],
    })

    const document = await docs
        .docs({ version: 'v1', auth })
        .documents.get({ documentId })

    return document.data
}

const getFile = async (fileId) => {
    const auth = new drive.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    const data = await drive
        .drive({ version: 'v3', auth })
        .files.get({ fileId, fields: '*' })

    return data.data
}

module.exports = { downloadDoc, getFile }
