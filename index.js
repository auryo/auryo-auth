var app = require('express')()
var server = require('http').Server(app)
var io = require('socket.io')(server)
var request = require('request')
require('dotenv').config()

server.listen(process.env.PORT || '3716')

app.use(function (req, res, next) {
    res.io = io
    next()
})

app.get('/connect', (req, res) => {
    const socket_id = req.query.state
    const env = req.query.env

    if (!socket_id || !env) {
        res.status(422)
            .send('Params are required')
        return
    }

    const redirect_url = (env === 'development') ? 'http://localhost:3716/oauth/callback' : 'http://api.auryo.com/callback'
    const client_id = (env === 'development') ? process.env.CLIENT_ID_DEV : process.env.CLIENT_ID

    return res.redirect(`https://soundcloud.com/connect?client_id=${client_id}&response_type=code&scope=non-expiring&state=${env}|${socket_id}&redirect_uri=${redirect_url}`)
})

app.get(process.env.CALLBACK, function (req, res) {
    let socket_id = req.query.state
    const code = req.query.code
    let env
    if (req.query.error) {
        res.io.to(socket_id).emit('error', req.query.error_description)
        res.redirect('http://auryo.com')
        return
    }

    if (socket_id && socket_id.split('|').length === 2) {
        env = socket_id.split('|')[0]
        socket_id = socket_id.split('|')[1]

        if (env === 'development') {
            return res.redirect(`http://api.auryo.com/callback${serialize(req.query)}`)
        }
    }

    if (!socket_id || !code) {
        res.status(422)
            .send('Params are required')
        return
    }

    const client_id = (env && env === 'development') ? process.env.CLIENT_ID_DEV : process.env.CLIENT_ID
    const client_secret = (env && env === 'development') ? process.env.CLIENT_SECRET_DEV : process.env.CLIENT_SECRET
    const redirect_uri = (env && env === 'development') ? 'http://localhost:3716/oauth/callback' : 'http://api.auryo.com/callback'

    request.post(
        'https://api.soundcloud.com/oauth2/token',
        {
            json: true,
            form: {
                client_id,
                client_secret,
                redirect_uri,
                grant_type: 'authorization_code',
                code: code
            }
        },
        function (error, response, body) {
            if (!error && response.statusCode === 200) {
                res.io.to(socket_id).emit('token', body.access_token)
                res.redirect('http://auryo.com/success.html')
            } else {
                res.status(400)
                    .send(body)
            }
        }
    )
})

function serialize(obj) {
    return '?' + Object.keys(obj).reduce(function (a, k) {
        a.push(k + '=' + encodeURIComponent(obj[k]))
        return a
    }, []).join('&')
}

module.exports = app