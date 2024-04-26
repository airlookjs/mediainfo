import child_process from 'child_process'
import { promisify } from 'util'

export const OutputFormats = {
    HTML: ['HTML', 'HTML'],
    XML: ['XML', 'XML'],
    OLDXML: ['OLDXML', 'XML'],
    JSON: ['JSON', 'JSON'],
    EBUCore: ['EBUCore','XML'],
    EBUCore_JSON: ['EBUCore_JSON','JSON'],
    PBCore: ['PBCore','XML'],
    PBCore2: ['PBCore2','XML']
 } as const;

export type OutputFormatKeys = keyof typeof OutputFormats
const cmd = 'mediainfo'

export async function getMediainfo(file: string, outputFormatKey: OutputFormatKeys) {

    const [value, format] = OutputFormats[outputFormatKey]
	console.log('Getting MediaInfo for: ' + file)

	const execFile = promisify(child_process.execFile)

	const { stdout, stderr } = await execFile(cmd, [`--Output=${value}`, file])

	if (stderr) {
		console.error('exec stderr', stderr)
		return { error: stderr }
	} else {
		let data = stdout
		if (format == 'JSON') {
			data = JSON.parse(stdout)
			return { mediainfo: data }
		}
		return data
	}
}
