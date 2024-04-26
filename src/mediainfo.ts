import child_process from 'child_process'
import { promisify } from 'util'

type OutputFormat = {
    name: string
    value: string
    format: string
}

const cmd = 'mediainfo'

export async function getMediainfo(file: string, outputFormat: OutputFormat = { name: 'EBUCore_JSON', value: 'EBUCore_JSON', format: 'JSON' }) {
	console.log('Getting MediaInfo for: ' + file)

	const execFile = promisify(child_process.execFile)

	const { stdout, stderr } = await execFile(cmd, [`--Output=${outputFormat.value}`, file])

	if (stderr) {
		console.error('exec stderr', stderr)
		return { error: stderr }
	} else {
		let data = stdout
		if (outputFormat.format == 'JSON') {
			data = JSON.parse(stdout)
			return { mediainfo: data }
		}
		return data
	}
}
