'use client'

import useFFMPEG from '~/hooks/useFFMPEG'

export default function Page() {
	const {transcode, loaded, videoRef, messageRef} = useFFMPEG()

	return (
		<div className='flex h-screen w-full flex-col justify-center gap-10 p-5 sm:p-20'>
			{loaded ? (
				<>
					<video
						ref={videoRef}
						controls
						className='h-96 w-full'
					/>
					<div
						ref={messageRef}
						className='text-xs'
					/>
					<input
						type='file'
						onChange={async e => {
							const file = e.target.files[0]
							if (!file) return
							await transcode(URL.createObjectURL(file), file.name)
						}}
					/>
				</>
			) : (
				<p>Loading...</p>
			)}
		</div>
	)
}
