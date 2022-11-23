//
// XMLTV format definition:
//
// https://github.com/XMLTV/xmltv/blob/master/xmltv.dtd
//
//

const fs = require('fs')
const { DateTime } = require('luxon')
const config = require('./config')

const TVH_BASE_URL = `${config.tvheadend.proto}://${config.tvheadend.user}:${config.tvheadend.password}@${config.tvheadend.host}:${config.tvheadend.port}`

const XML_START = `
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE tv SYSTEM "xmltv.dtd">
<tv generator-info-name="XMLTV-be 1.0" source-info-name="Kalios IPTV">
`

function channelToXML(channel) {
  return `
  <channel id="${channel.uuid}">
    <display-name>${channel.name}</display-name>
    <display-name>${channel.number}</display-name>
    <icon src="${TVH_BASE_URL}/${channel.picon}"/>
  </channel>
  `
}

function eventToXML(event, channelUuid) {
  if (event.Titles.Title[0] == undefined) return

  const startTime = DateTime.fromISO(event.AvailabilityStart).toFormat('yyyyMMddHHmmss ZZZ')
  const endTime = DateTime.fromISO(event.AvailabilityEnd).toFormat('yyyyMMddHHmmss ZZZ')
  const metadata = event.Titles.Title[0]
  const genre = metadata.Genres.Genre[0] && metadata.Genres.Genre[0].Value
  const genreId = metadata.Genres.Genre[0] && metadata.Genres.Genre[0].type.split('.')[0]

  let title = metadata.Name ?? ''
  let subtitle = metadata.ShortSynopsis ?? ''
  let description = metadata.LongSynopsis ?? ''
  let xmlBody = `<programme start="${startTime}" stop="${endTime}" channel="${channelUuid}">\n`

  // If programme is a series episode, manually set the title to the name of the series.
  // Also set the season and episode numbers.
  // Also check if the name of the episode is in the summary and set it if it is.
  if (genreId == '3') {
    if (metadata.SeriesCollection && metadata.SeriesCollection.Series[0]) {
      const season = metadata.SeriesCollection.Series[0]
      const series = season.ParentSeriesCollection
      const episodeNumber = (season.RelationOrdinal - 1) ?? ''

      let seasonNumber = ''
      title = season.Name

      if (series && series.Series[0]) {
        seasonNumber = (series.Series[0].RelationOrdinal - 1) ?? ''
        title = series.Series[0].Name
      }

      xmlBody += `<episode-num system="xmltv_ns">${seasonNumber} . ${episodeNumber} . </episode-num>\n`

      let episodeName = description.match(/«(.+)»/m)
      if (episodeName) subtitle = episodeName[1]
    }
  }

  xmlBody += `<title>${title}</title>\n`
  xmlBody += `<sub-title>${subtitle}</sub-title>\n`
  xmlBody += `<desc>${description}</desc>\n`
  xmlBody += `<category lang="fr">${genre}</category>\n`

  if (metadata.Actors) {
    for (let actor of metadata.Actors.Actor) {
      xmlBody += `<actor>${actor}</actor>\n`
    }
  }

  if (metadata.Directors) {
    for (let director of metadata.Directors.Director) {
      xmlBody += `<director>${director}</director>\n`
    }
  }

  if (event.OriginalLanguages) {
    for (let lang of event.OriginalLanguages.OriginalLanguage) {
      xmlBody += `<orig-language>${lang}</orig-language>\n`
    }
  }

  if (event.DubbedLanguages) {
    for (let lang of event.DubbedLanguages.DubbedLanguage) {
      xmlBody += `<language>${lang}</language>\n`
    }
  }

  if (event.CaptionLanguages) {
    for (let lang of event.CaptionLanguages.CaptionLanguage) {
      xmlBody += `<subtitles>${lang}</subtitles>\n`
    }
  }

  // We choose to only append one picture because we don't have the width and height of each of the available pictures.
  // And we don't want to spam the servers of VOO twice (first when retrieving the dimensions, then when downloading
  // the pictures). So only one, 'Banner0' is actually a poster. 'Poster' is often a landscape-oriented picture.
  if (metadata.Pictures) {
    let chosenPic

    for (let picture of metadata.Pictures.Picture) {
      if (picture.type === 'Poster') chosenPic = picture.Value
      if (picture.type === 'Banner0') chosenPic = picture.Value
    }

    xmlBody += `<icon src="${chosenPic}"></icon>\n`
  }

  xmlBody += '</programme>'

  return xmlBody
}

function sanitizeXML(input) {
  let sanitized = input.replaceAll('&', '&amp;')

  return sanitized
}

module.exports = {
  convert: async function (epgData) {
    if (epgData == undefined) return

    const channelMapping = JSON.parse(fs.readFileSync(config.files.channelMapping).toString())
    let allXml = XML_START
    let channelsXml = ''
    let progXml = ''

    for (let channel of epgData.Channels.Channel) {
      let channelInfo = channelMapping[channel.id]
      channelsXml += channelToXML(channelInfo)

      if (channel.Events && channel.Events.Event.length > 0) {
        for (let event of channel.Events.Event) {
          progXml += eventToXML(event, channelInfo.uuid)
        }
      }
    }

    allXml += channelsXml
    allXml += progXml
    allXml += '</tv>'

    fs.writeFileSync(config.files.xmltv, sanitizeXML(allXml))
  }
}
