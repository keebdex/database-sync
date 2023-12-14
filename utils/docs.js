const docs = require('@googleapis/docs')
const drive = require('@googleapis/drive')
const path = require('path')

const downloadDoc = async (documentId) => {
    const auth = new docs.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/documents'],
    })

    const { data } = await docs
        .docs({ version: 'v1', auth })
        .documents.get({ documentId })

    return data
}

const getFile = async (fileId) => {
    const auth = new drive.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    const { data } = await drive
        .drive({ version: 'v3', auth })
        .files.get({ fileId, fields: '*' })

    return data
}

const getRevisions = async (fileId, revisions = [], pageToken) => {
    const auth = new drive.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    const { data } = await drive
        .drive({ version: 'v3', auth })
        .revisions.list({ fileId, fields: '*', pageToken })

    revisions = revisions.concat(data.revisions)

    if (data.nextPageToken) {
        return getRevisions(fileId, revisions, data.nextPageToken)
    }

    return revisions
}

module.exports = { downloadDoc, getFile, getRevisions }
