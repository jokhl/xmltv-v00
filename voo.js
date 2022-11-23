const fs = require('fs')
const axios = require('axios').default
const { DateTime } = require('luxon')
const config = require('./config')

const VOO_EPG_XML_REQUEST = `
<Request
	xmlns="urn:eventis:traxisweb:1.0">
	<ResourcesQuery resourceType="Channel">
		<ResourceIds>
			{{ CHANNELS }}
		</ResourceIds>
		<Options>
			<Option type="Props">Pictures,LogicalChannelNumber,PersonalChannelNumber,Name,LongName</Option>
		</Options>
		<SubQueries>
			<SubQuery relationName="Events">
				<Options>
					<Option type="filter">AvailabilityEnd&gt;{{ FROM }}&amp;AvailabilityStart&lt;{{ TO }}</Option>
					<Option type="props">OnReminders,IsRecorded,IsAvailable,Products,AvailabilityEnd,AvailabilityStart,Titles,OriginalLanguages,DubbedLanguages,CaptionLanguages,Softlinks</Option>
				</Options>
				<SubQueries>
					<SubQuery relationName="Titles">
						<Options>
							<Option type="Props">SeriesCollection,Ordinal,Name,ShortSynopsis,LongSynopsis,ProductionDate,Pictures,MinimumAge,EpisodeName,IsAdult,Contents,Genres,Actors,Directors</Option>
						</Options>
						<SubQueries>
							<SubQuery relationName="SeriesCollection">
								<Options>
									<Option type="props">Name,RelationOrdinal,TitleCount</Option>
								</Options>
								<SubQueries>
									<SubQuery relationName="ParentSeriesCollection">
										<Options>
											<Option type="Props">Name,RelationOrdinal</Option>
										</Options>
									</SubQuery>
								</SubQueries>
							</SubQuery>
						</SubQueries>
					</SubQuery>
				</SubQueries>
			</SubQuery>
		</SubQueries>
	</ResourcesQuery>
</Request>
`
// VOO API endpoints
const VOO_API_EPG = `https://publisher.voo.be/traxis/web/?output=json`

module.exports = {
  getEPGLocal: async function (mapping) {
    return JSON.parse(fs.readFileSync(config.files.vooEPG).toString())
  },
  getEPG: async function (mapping) {
    const channelRefs = Object.keys(mapping).map(ref => `<ResourceId>${ref}</ResourceId>`)
    const channelStr = channelRefs.join('')

    let xmlRequest = VOO_EPG_XML_REQUEST.replace('{{ CHANNELS }}', channelStr)
    xmlRequest = xmlRequest.replace('{{ FROM }}', DateTime.now().toFormat('yyyy-MM-dd'))
    xmlRequest = xmlRequest.replace('{{ TO }}', DateTime.now().plus({ days: 2 }).toFormat('yyyy-MM-dd'))

    const resp = await axios.post(VOO_API_EPG, xmlRequest, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:93.0) Gecko/20100101 Firefox/93.0',
        'Content-Type': 'application/xml'
      }
    })

    let epgData

    if (resp.status === 200) {
      fs.writeFileSync(config.files.vooEPG, JSON.stringify(resp.data))
      epgData = resp.data
    } else {
      console.error(resp)
    }

    return epgData
  }
}
