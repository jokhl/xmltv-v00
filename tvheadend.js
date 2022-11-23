const fs = require('fs')
const axios = require('axios').default
const config = require('./config')

// TVHeadend API endpoints
const TVH_API_MUXES = `/api/mpegts/mux/grid?limit=9999`
const TVH_API_SERVICES = `/api/mpegts/service/grid?limit=9999`
const TVH_API_CHANNELS = `/api/channel/grid?limit=9999`

const http = axios.create({
  baseURL: `${config.tvheadend.proto}://${config.tvheadend.user}:${config.tvheadend.password}@${config.tvheadend.host}:${config.tvheadend.port}`,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:93.0) Gecko/20100101 Firefox/93.0'
  }
})

module.exports = {
  getTVHData: async function () {
    let resp
    const data = {}

    resp = await http.get(TVH_API_MUXES)
    fs.writeFileSync(config.files.muxes, JSON.stringify(resp.data))
    data.muxes = resp.data

    resp = await http.get(TVH_API_SERVICES)
    fs.writeFileSync(config.files.services, JSON.stringify(resp.data))
    data.services = resp.data

    resp = await http.get(TVH_API_CHANNELS)
    fs.writeFileSync(config.files.channels, JSON.stringify(resp.data))
    data.channels = resp.data

    return data
  },
  genChannelMapping: async function (data) {
    const mapping = {}
    const muxesHash = {}
    const channelsHash = {}

    for (let mux of data.muxes.entries) {
      muxesHash[mux.uuid] = { tsid: mux.tsid, channels: [] }
    }

    for (let channel of data.channels.entries) {
      channelsHash[channel.uuid] = {
        uuid: channel.uuid,
        name: channel.name,
        number: channel.number,
        picon: channel.icon_public_url
      }
    }

    for (let service of data.services.entries) {
      const tsid = muxesHash[service.multiplex_uuid].tsid
      const sid = service.sid
      const ref = `1:${tsid}:${sid}`

      if (service.channel.length > 0) mapping[ref] = channelsHash[service.channel[0]]
    }

    fs.writeFileSync(config.files.channelMapping, JSON.stringify(mapping))

    return mapping
  }
}
