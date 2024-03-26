/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	async headers() {
		return [
			{
				// Apply these headers to all routes in your application.
				source: '/:path*',
				headers: [
					{key: 'Cross-Origin-Opener-Policy', value: 'same-origin'},
					{key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'}
				]
			}
		]
	}
}

export default nextConfig
