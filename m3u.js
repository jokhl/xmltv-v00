//
// xTeVe playlist format:
//
// https://github.com/xteve-project/xTeVe-Documentation/blob/master/en/configuration.md
//
//

const { EOL } = require('os')
const fs = require('fs')
const readline = require('readline')
const axios = require('axios').default
const config = require('./config')

const TVH_API_M3U = `/playlist/channels.m3u`

const http = axios.create({
  baseURL: `${config.tvheadend.proto}://${config.tvheadend.user}:${config.tvheadend.password}@${config.tvheadend.host}:${config.tvheadend.port}`,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:93.0) Gecko/20100101 Firefox/93.0'
  },
  responseType: 'stream'
})

module.exports = {
  genPlaylist: async function () {
    http
      .get(TVH_API_M3U)
      .then(resp => {
        const rl = readline.createInterface({
          input: resp.data,
          terminal: false
        })

        const m3uFS = fs.createWriteStream(config.files.m3u)

        rl.on('line', line => {
          m3uFS.write(line.replace('tvg-chno', 'CUID') + EOL)
        })
      })

    // let newPlaylistBody = playlistBody.replaceAll('tvg-chno', 'CUID')
  }
}
