require('dotenv').config()

const { default: axios } = require('axios')
const fs = require('fs')
const FormData = require('form-data')

async function downloadImage(url, filename) {
    const response = await axios.get(url, { responseType: 'arraybuffer' })

    const [, ext] = response.headers['content-type'].split('/')

    fs.writeFile(
        `images/${filename}.${ext.toLowerCase()}`,
        response.data,
        (err) => {
            if (err) {
                console.error('unable to download image', filename, err)
            }

            // console.log('image downloaded successfully', filename)
        }
    )
}

async function uploadImage(filename, url) {
    let data = new FormData()

    data.append('url', url)
    data.append('id', filename)

    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/images/v1`,
        headers: {
            Authorization: `Bearer ${process.env.CF_IMAGE_TOKEN}`,
        },
        data,
    }

    await axios(config)
        .then(({ data }) => {
            // console.log(JSON.stringify(response.data))
        })
        .catch(({ response, message }) => {
            const { data } = response

            console.error(
                'unable to upload image',
                filename,
                message,
                JSON.stringify(data)
            )
        })
}

async function getListImages(images = [], token) {
    const config = {
        method: 'get',
        url: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/images/v2`,
        headers: {
            Authorization: `Bearer ${process.env.CF_IMAGE_TOKEN}`,
        },
        params: {
            continuation_token: token,
        },
    }

    return axios(config).then(({ data: { result } }) => {
        const ids = result.images.map((i) => i.id)

        images = images.concat(ids)

        if (result.continuation_token) {
            return getListImages(images, result.continuation_token)
        }

        return images
    })
}

module.exports = { downloadImage, uploadImage, getListImages }
