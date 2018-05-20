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

app.get(process.env.CALLBACK, function (req, res) {
    const socket_id = req.query.state
    const code = req.query.code

    if (req.query.error) {
        res.io.to(socket_id).emit('error', req.query.error_description)
        res.redirect('http://auryo.com')
    }

    if (!socket_id || !code) {
        res.status(422)
            .send('Params are required')
        return
    }

    request.post(
        'https://api.soundcloud.com/oauth2/token',
        {
            json: true,
            form: {
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                redirect_uri: process.env.REDIRECT_URL,
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

module.exports = app