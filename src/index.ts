import fs from 'fs'
import os from 'os'
import url from 'url'
import path from 'path'
import express from 'express'
import cors from 'cors'

// TODO: conditionally enable prometheus
//import prometheus from 'prom-client'

import { config } from './config.js'
import { getMediainfo } from './mediainfo.js'

const server = express()

const collectDefaultMetrics = prometheus.collectDefaultMetrics
// Probe every 10th second.
collectDefaultMetrics({ timeout: 10000 })

const HOSTNAME = os.hostname()

server.use(cors())

// eslint-disable-next-line no-unused-vars
server.get(`${config.route}/:path(*)`, async (req, res, next) => {
	console.log('Processing request', req.url, '->', req.params.path)

	let error = null

	let foundMatchingMountedFile = false

	const pathParam = req.params.path

	// process outputFormat query parameter

	const outputFormatQS = req.query.outputFormat || config.defaultOutputFormatName
	let outputFormat = {}

	if (config.outputFormats.map((f) => f.name).includes(outputFormatQS)) {
		outputFormat = config.outputFormats.find((f) => f.name === outputFormatQS)
		console.info('Using outputFormat', outputFormat)
	} else {
		error = `Invalid outputFormat: ${outputFormatQS}`
		console.error(error)
		next(new Error(error))
		return
	}

	if (pathParam) {
		// check if file is matched by a share and if so, run the mediainfo analysis
		for (const share of config.shares) {
			console.info('Checking share', share.name, 'for matches')
			for (const match of share.matches) {
				console.info('Checking match', match, 'for', pathParam)
				const matchResult = pathParam.match(match)
				if (matchResult && matchResult[1]) {
					console.info('-> match found', matchResult[1])
					const mountedFilePath = path.join(share.mount, matchResult[1])
					if (fs.existsSync(mountedFilePath)) {
						console.log('Analysing file', mountedFilePath)
						foundMatchingMountedFile = true

						const jsonFolderPath = path.join(path.dirname(mountedFilePath), '.cache/mediainfo/')

						const jsonFilePath = path.join(
							jsonFolderPath,
							path.basename(mountedFilePath) + '.mediainfo.json'
						)

						let sentCachedResult = false

						if (share.cached && outputFormat.name == config.defaultOutputFormatName) {
							// check if mediainfo data is cached on drive
							if (fs.existsSync(jsonFilePath)) {
								try {
									// check if json file is newer than the file itself
									const mountedFileStats = await fs.promises.stat(mountedFilePath)
									const jsonFileStats = await fs.promises.stat(jsonFilePath)

									if (jsonFileStats.mtimeMs < mountedFileStats.mtimeMs) {
										console.info('Cached mediainfo file is older than file, ignoring')
									} else {
										console.info('Serving cached result from file', jsonFilePath)
										const fileData = await fs.promises.readFile(jsonFilePath)
										const jsonData = JSON.parse(fileData.toString())
										jsonData.cached = true
										jsonData.version = config.version
										res.json(jsonData)
										sentCachedResult = true
									}
								} catch (err) {
									if (err.code === 'ENOENT') {
										console.info('Cached mediainfo file not found: ' + jsonFilePath)
									} else {
										next(err)
									}
								}
							}
						}

						if (!sentCachedResult) {
							const data = await getMediainfo(mountedFilePath, outputFormat)
							if (data.error) {
								console.error('Error computing mediainfo: ' + data.error)
								error = data.error
								next(data.error)
							} else {
								if (share.cached && outputFormat.name == config.defaultOutputFormatName) {
									// create cache folder if it doesn't exist
									try {
										if (!fs.existsSync(jsonFolderPath)) {
											fs.mkdirSync(jsonFolderPath, { recursive: true })
										}
									} catch (err) {
										console.error('Error creating cache folder', err)
										next(err)
									}
									// save the result to file
									try {
										await fs.promises.writeFile(jsonFilePath, JSON.stringify(data))
									} catch (err) {
										console.error('Error writing mediainfo file', err)
									}
								}
								if (outputFormat.format == 'JSON') {
									data.version = config.version
									res.json(data)
								} else if (outputFormat.format == 'XML') {
									res.set('Content-Type', 'text/xml')
									res.send(data)
								} else {
									res.send(data)
								}
							}
						}
					} else {
						console.info('File not found: ' + mountedFilePath)
					}
				} else {
					console.info('-> not matching')
				}
			}
			if (foundMatchingMountedFile) return
		}

		if (!foundMatchingMountedFile && pathParam.indexOf('http') === 0) {
			// Media file is not mounted, attempt using URL

			const stringIsAValidUrl = (s, protocols) => {
				try {
					new url.URL(s)
					const parsed = url.parse(s)
					return protocols
						? parsed.protocol
							? protocols.map((x) => `${x.toLowerCase()}:`).includes(parsed.protocol)
							: false
						: true
				} catch (err) {
					return false
				}
			}

			try {
				if (stringIsAValidUrl(pathParam, ['http', 'https'])) {
					const data = await getMediainfo(pathParam, outputFormat)
					if (data.error) {
						console.error('Error computing mediainfo: ' + data.error)
						error = data.error
						next(data.error)
					} else {
						console.info('Sending result')
						foundMatchingMountedFile = true
						if (outputFormat.format == 'JSON') {
							data.version = config.version
							res.json(data)
						} else if (outputFormat.format == 'XML') {
							res.set('Content-Type', 'text/xml')
							res.send(data)
						} else {
							res.send(data)
						}
					}
				}
			} catch (error) {
				console.error(error)
				next(error)
			}
		}

		// if we get here, no match was found for the file in any of the shares
		if (!foundMatchingMountedFile && error === null) {
			console.log('File was not found: ' + pathParam)
			next(new Error('File was not found: ' + pathParam))
		}
	} else {
		console.log('Missing file argument')
		res.status(400)
		res.json({ error: 'Missing file argument' })
	}
})

/*
const checks = 
    config.shares.map(share => {
        return {
            name: `Connection to ${share.name} Storage`,
            description: `Is directory readable at ${share.mount}`,
            checkFn: function() {
                if (!fs.existsSync(share.mount)) {
                    throw new Error(`${share.name} storage share at ${share.mount} could not be accessed.`)
                }
            }
        }
    });

server.use('/status', getExpressHealthRoute(checks));
*/

server.get('/', function (req, res) {
	res.send('MediaInfo is running')
})

/*server.get('/metrics', function (req, res) {
	res.send(prometheus.register.metrics())
})*/

// Fallthrough error handler
// eslint-disable-next-line no-unused-vars
server.use(function onError(err, req, res, next) {
	// The error id is attached to `res.sentry` to be returned
	// and optionally displayed to the user for support.
	res.statusCode = 500
	res.json({ error: err.message })
	//res.end(err + "\n" + "Report this Sentry ID to the developers: " + res.sentry + '\n');
})

server.listen(config.port, function () {
	console.log(`MediaInfo ${config.version} scanner listening on ${HOSTNAME}:${config.port}`)
})
