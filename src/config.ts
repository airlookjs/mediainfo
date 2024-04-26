// parse bools from env safely
const parseBoolEnv = (env, defaultValue) => {
	if (env === undefined) {
		return defaultValue
	}
	if (env === 'true') {
		return true
	}
	if (env === 'false') {
		return false
	}
	return defaultValue
}

// parse ints from env safely
const parseIntEnv = (env, defaultValue) => {
	if (env === undefined) {
		return defaultValue
	}
	const parsed = parseInt(env)
	if (isNaN(parsed)) {
		return defaultValue
	}
	return parsed
}

const sharedConfig = getSharedConfig({
	shares: {
		agis: {
			mount: process.env.SHARE_AIRLOOK_MOUNT || '/mnt/agis-store',
			cached: parseBoolEnv(process.env.SHARE_AIRLOOK_CACHED, true)
		}
	},
	environment: process.env.NODE_ENV || 'development'
})

export const config = {
	environment: process.env.NODE_ENV || 'development',
	version: process.env.npm_package_version || 'dev',
	port: parseIntEnv(process.env.PORT, 3000),
	route: process.env.ROUTE || '/api/mediainfo',
	defaultOutputFormatName: process.env.DEFAULT_OUTPUT_FORMAT || 'EBUCore_JSON',
	outputFormats: [
		{ name: 'HTML', value: 'HTML', format: 'HTML' },
		{ name: 'XML', value: 'XML', format: 'XML' },
		{ name: 'OLDXML', value: 'OLDXML', format: 'XML' },
		{ name: 'JSON', value: 'JSON', format: 'JSON' },
		{ name: 'EBUCore', value: 'EBUCore', format: 'XML' },
		{ name: 'EBUCore_JSON', value: 'EBUCore_JSON', format: 'JSON' },
		{ name: 'PBCore', value: 'PBCore', format: 'XML' },
		{ name: 'PBCore2', value: 'PBCore2', format: 'XML' }
	],
	shares: Object.values(sharedConfig.shares)
}
