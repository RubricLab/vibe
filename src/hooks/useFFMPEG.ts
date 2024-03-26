// 'use client'

// import {FFmpeg} from '@ffmpeg/ffmpeg'
// import {fetchFile, toBlobURL} from '@ffmpeg/util'
// import {useEffect, useRef, useState} from 'react'

// export default function useFFMPEG() {
// 	const [loaded, setLoaded] = useState(false)
// 	const ffmpegRef = useRef(new FFmpeg())
// 	const videoRef = useRef(null)
// 	const messageRef = useRef(null)

// 	const threads = navigator.hardwareConcurrency
// 	console.log('threads', threads)
// 	const usableThreads = threads - 2 > 0 ? threads - 2 : 1
// 	const load = async () => {
// 		const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd'
// 		const ffmpeg = ffmpegRef.current
// 		ffmpeg.on('log', ({message}) => {
// 			messageRef.current.innerHTML = message
// 			console.log(message)
// 		})
// 		// toBlobURL is used to bypass CORS issue, urls with the same
// 		// domain can be used directly.
// 		await ffmpeg.load({
// 			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
// 			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
// 			workerURL: await toBlobURL(
// 				`${baseURL}/ffmpeg-core.worker.js`,
// 				'text/javascript'
// 			)
// 		})
// 		setLoaded(true)
// 	}

// 	const transcode = async (fileUrl: string, fileName: string, args) => {
// 		const ffmpeg = ffmpegRef.current
// 		await ffmpeg.writeFile(fileName, await fetchFile(fileUrl))
// 		await ffmpeg.exec([
// 			'-i', fileName,
// 			'-threads', usableThreads.toString(), // Use all but 2 threads.
// 			'-preset', 'ultrafast', // Use a faster preset.
//   			'-vf', 'scale=360:-2,format=gray', // Lower resolution and convert to grayscale.
//   			'-b:v', '500k', // Lower bitrate to reduce quality and file size.
//   			'-r', '15', // Reduce frame rate.
// 			'output.mp4',
// 		  ]);
// 		const data = await ffmpeg.readFile('output.mp4')
// 		videoRef.current.src = URL.createObjectURL(
// 			new Blob([data.buffer], {type: 'video/mp4'})
// 		)
// 	}

// 	useEffect(() => {
// 		load()
// 	}, [])

// 	return {transcode, loaded, videoRef, messageRef}
// }

'use client'

import {FFmpeg} from '@ffmpeg/ffmpeg'
import {fetchFile, toBlobURL} from '@ffmpeg/util'
import {useEffect, useRef, useState} from 'react'

export default function useFFMPEG() {
	const [loaded, setLoaded] = useState(false)
	const ffmpegRef = useRef(new FFmpeg())
	const videoRef = useRef(null)
	const messageRef = useRef(null)
	const mediaSourceRef = useRef(null)
	const sourceBufferRef = useRef(null)
	const [currentSegment, setCurrentSegment] = useState(0)
	const totalSegments = 20 // Example total number of segments

	const [readyForNextSegment, setReadyForNextSegment] = useState(false)

	const [fileNameState, setFileNameState] = useState()

	const bufferQueue = useRef([])

	const threads = navigator.hardwareConcurrency
	const usableThreads = threads - 2 > 0 ? threads - 2 : 1

	const loadFFMPEG = async () => {
		const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd'
		const ffmpeg = ffmpegRef.current
		ffmpeg.on('log', ({message}) => {
			messageRef.current.innerHTML = message
			console.log(message)
		})
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
			workerURL: await toBlobURL(
				`${baseURL}/ffmpeg-core.worker.js`,
				'text/javascript'
			)
		})
		setLoaded(true)
	}

	useEffect(() => {
		loadFFMPEG()
	}, [])

	useEffect(() => {
		if (loaded) initMediaSource()
	}, [loaded])

	const initMediaSource = () => {
		if ('MediaSource' in window && MediaSource.isTypeSupported('video/mp4')) {
			mediaSourceRef.current = new MediaSource()
			videoRef.current.src = URL.createObjectURL(mediaSourceRef.current)
			mediaSourceRef.current.addEventListener('sourceopen', handleSourceOpen, {
				once: true
			})
		} else console.error('MediaSource or codec not supported')
	}

	const handleSourceOpen = () => {
		sourceBufferRef.current = mediaSourceRef.current.addSourceBuffer('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
		sourceBufferRef.current.addEventListener('updateend', () => {
			setReadyForNextSegment(true);
	
			// Process the next buffer in the queue if available
			if (bufferQueue.current.length > 0 && !sourceBufferRef.current.updating) {
				const nextBuffer = bufferQueue.current.shift(); // Remove the next buffer from the queue
				sourceBufferRef.current.appendBuffer(nextBuffer); // Append it to the SourceBuffer
			}
	
			// Update the MediaSource duration
			if (mediaSourceRef.current.readyState === 'open') 
				// Each segment adds 5 seconds, so update the duration accordingly
				// Note: This assumes segments are processed and appended in order
				mediaSourceRef.current.duration += 5;
			
		});
	
		setReadyForNextSegment(true);
	};

	useEffect(() => {
		if (
			fileNameState &&
			currentSegment < totalSegments &&
			readyForNextSegment &&
			!sourceBufferRef.current.updating
		) {
			transcodeSegment(fileNameState, 5, currentSegment * 5, currentSegment)
			setCurrentSegment(currentSegment + 1)
			setReadyForNextSegment(false) // Reset flag until the next updateend event
		} else if (currentSegment >= totalSegments)
			mediaSourceRef.current.endOfStream()
	}, [currentSegment, readyForNextSegment, fileNameState]) // Depend on currentSegment and the control flag

	const transcodeSegment = async (
		fileName,
		segmentDuration = 5,
		start = 0,
		segmentIndex = 0
	) => {
		const ffmpeg = ffmpegRef.current

		await ffmpeg.exec([
			'-ss',
			`${start}`, // Start time for the segment
			'-t',
			`${segmentDuration}`, // Duration of the segment
			'-i',
			fileName,
			'-threads',
			`${usableThreads}`,
			'-preset',
			'ultrafast',
			'-vf',
			'scale=360:-2,format=gray',
			'-b:v',
			'500k',
			'-r',
			'15',
			'-movflags',
			'+faststart', // Ensure moov atom is at the start of the file
			`output_${segmentIndex}.mp4` // Name each segment file uniquely
		])
		const data = await ffmpeg.readFile(`output_${segmentIndex}.mp4`)
		appendBufferToSource(new Uint8Array(data.buffer))
	}

	const appendBufferToSource = buffer => {
		if (sourceBufferRef.current && !sourceBufferRef.current.updating)
			sourceBufferRef.current.appendBuffer(buffer)
		else bufferQueue.current.push(buffer)
		// Check if it's the first segment and if the video is not already playing
		if (currentSegment === 1 && videoRef.current.paused)
			// Use a promise-based approach to handle play() since it returns a promise
			videoRef.current.play().catch(error => {
				console.error('Error attempting to play video:', error)
			})
	}

	// Expose a method to initiate the transcoding process with a new file
	const transcode = async (fileUrl, fileName) => {
		setCurrentSegment(0)
		setFileNameState(fileName)
		const ffmpeg = ffmpegRef.current

		await ffmpeg.writeFile(fileName, await fetchFile(fileUrl))

		await transcodeSegment(fileName)

		// You might need additional logic here to start the transcoding process for a new file
	}

	return {transcode, loaded, videoRef, messageRef}
}
