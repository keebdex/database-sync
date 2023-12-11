const docs = require('@googleapis/docs')
const drive = require('@googleapis/drive')
const { uniqBy } = require('lodash')
const path = require('path')

const downloadDoc = async (documentId) => {
    const auth = new docs.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/documents'],
    })

    const document = await docs
        .docs({ version: 'v1', auth })
        .documents.get({ documentId })

    return document
}

const getFile = async (fileId) => {
    const auth = new drive.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '/keebtalogue.json'),
        scopes: ['https://www.googleapis.com/auth/drive'],
    })

    const {
        data: { owners, lastModifyingUser, modifiedTime },
    } = await drive
        .drive({ version: 'v3', auth })
        .files.get({ fileId, fields: '*' })

    const users = lastModifyingUser
        ? owners.concat([lastModifyingUser])
        : owners

    const contributors = uniqBy(users, 'displayName').map((u) => ({
        name: u.displayName,
        picture: u.photoLink,
    }))

    return {
        contributors,
        updated_at: modifiedTime,
    }
}

module.exports = { downloadDoc, getFile }
